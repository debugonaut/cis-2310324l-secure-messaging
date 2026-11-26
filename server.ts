/**
 * Relay server — Secure Messaging System
 * --------------------------------------
 * A deliberately "honest" relay: it routes room presence and opaque encrypted
 * envelopes. It never receives a passphrase, a key, or a plaintext message.
 *
 *   bun server.ts --port 3001          # relay only, serves ./dist if built
 *   bun server.ts --port 3001 --dev    # relay only, Vite handles the UI
 *
 * HTTP
 *   POST /api/rooms            -> create room { id, salt, createdAt }
 *   GET  /api/rooms/:id        -> room info { id, salt, createdAt, participants }
 *
 * WebSocket  /ws
 *   -> { t: "join", room, name, role }
 *   <- { t: "joined", selfId, room, participants }
 *   <- { t: "presence", participants }
 *   -> { t: "envelope", id, envelope }
 *   <- { t: "envelope", id, from, fromName, envelope, at }
 *   -> { t: "ack", id }
 *   <- { t: "ack", id, from, at }
 */

type Role = "alice" | "bob";

interface RoomMember {
  id: string;
  name: string;
  role: Role;
  socket: ServerWebSocket<SocketData>;
}

interface Room {
  id: string;
  salt: string;
  createdAt: number;
  members: Map<string, RoomMember>;
}

interface SocketData {
  memberId?: string;
  roomId?: string;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(flag("port", "3001")) || Number(process.env.PORT) || 3001;
const DEV = args.includes("--dev") || process.env.RELAY_DEV === "1";
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENVELOPE_CHARS = 64 * 1024;

const rooms = new Map<string, Room>();

const ID_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRoomId(): string {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i += 1) id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return id;
}

function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function publicRoom(room: Room) {
  return {
    id: room.id,
    salt: room.salt,
    createdAt: room.createdAt,
    participants: [...room.members.values()].map((m) => ({ name: m.name, role: m.role })),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function send(socket: ServerWebSocket<SocketData>, payload: unknown) {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    /* socket already closing */
  }
}

function broadcast(room: Room, payload: unknown, exceptId?: string) {
  for (const member of room.members.values()) {
    if (member.id === exceptId) continue;
    send(member.socket, payload);
  }
}

function presence(room: Room) {
  broadcast(room, {
    t: "presence",
    participants: [...room.members.values()].map((m) => ({ name: m.name, role: m.role })),
  });
}

function pruneRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const stale = now - room.createdAt > ROOM_TTL_MS;
    const empty = room.members.size === 0 && now - room.createdAt > 30 * 60 * 1000;
    if (stale || empty) rooms.delete(id);
  }
}

setInterval(pruneRooms, 5 * 60 * 1000);

/* ------------------------------------------------------------------ */
/* Static assets (production)                                          */
/* ------------------------------------------------------------------ */

const distDir = new URL("./dist/", import.meta.url);
const hasBuild = await Bun.file(new URL("index.html", distDir)).exists();

async function serveStatic(pathname: string): Promise<Response> {
  if (!hasBuild || DEV) {
    return json({ error: "relay running without a build — start Vite for the UI", hint: "bun run dev" }, 404);
  }

  const clean = pathname === "/" ? "/index.html" : pathname;
  const target = new URL(`.${clean}`, distDir);
  if (!target.pathname.startsWith(distDir.pathname)) return new Response("Forbidden", { status: 403 });

  const file = Bun.file(target);
  if (await file.exists()) {
    const immutable = clean.startsWith("/assets/");
    return new Response(file, {
      headers: immutable ? { "cache-control": "public, max-age=31536000, immutable" } : { "cache-control": "no-cache" },
    });
  }

  return new Response(Bun.file(new URL("index.html", distDir)), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const server = Bun.serve<SocketData, never>({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 255,

  async fetch(request, srv) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const ok = srv.upgrade(request, { data: {} });
      return ok ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, rooms: rooms.size, build: hasBuild });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let id = newRoomId();
      while (rooms.has(id)) id = newRoomId();
      const room: Room = { id, salt: newSalt(), createdAt: Date.now(), members: new Map() };
      rooms.set(id, room);
      console.log(`[room] created ${id}`);
      return json(publicRoom(room));
    }

    const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4,12})$/i);
    if (roomMatch) {
      const room = rooms.get(roomMatch[1].toUpperCase());
      if (!room) return json({ error: "room-not-found" }, 404);
      return json(publicRoom(room));
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not-found" }, 404);

    return serveStatic(url.pathname);
  },

  websocket: {
    open() {
      /* waiting for the join frame */
    },

    message(socket, raw) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer));
      } catch {
        return send(socket, { t: "error", code: "bad-json" });
      }

      const data = socket.data as SocketData;

      if (msg.t === "join") {
        const roomId = String(msg.room ?? "").toUpperCase();
        const name = String(msg.name ?? "").slice(0, 32).trim() || "Guest";
        const role: Role = msg.role === "bob" ? "bob" : "alice";

        const room = rooms.get(roomId);
        if (!room) return send(socket, { t: "error", code: "room-not-found" });

        const occupant = [...room.members.values()].find((m) => m.role === role);
        if (occupant) {
          // Same person reconnecting (e.g. refresh): take over the slot.
          send(occupant.socket, { t: "replaced" });
          try {
            occupant.socket.close();
          } catch {
            /* ignore */
          }
          room.members.delete(occupant.id);
        }

        if (room.members.size >= 2) return send(socket, { t: "error", code: "room-full" });

        const memberId = crypto.randomUUID();
        room.members.set(memberId, { id: memberId, name, role, socket });
        data.memberId = memberId;
        data.roomId = room.id;

        // Acknowledge the joiner first, then tell everyone else.
        send(socket, { t: "joined", selfId: memberId, room: publicRoom(room) });
        presence(room);

        // Replay the pending envelopes? No: this relay is stateless by design and
        // tells the sender "not delivered" instead of hiding a lost message.
        return;
      }

      if (!data.memberId || !data.roomId) return send(socket, { t: "error", code: "not-joined" });
      const room = rooms.get(data.roomId);
      const member = room?.members.get(data.memberId);
      if (!room || !member) return send(socket, { t: "error", code: "not-joined" });

      if (msg.t === "envelope") {
        const envelope = msg.envelope;
        const id = String(msg.id ?? "");
        if (!envelope || typeof envelope !== "object") return send(socket, { t: "error", code: "bad-envelope" });
        if (JSON.stringify(envelope).length > MAX_ENVELOPE_CHARS) {
          return send(socket, { t: "error", code: "envelope-too-large" });
        }

        const others = [...room.members.values()].filter((m) => m.id !== member.id);
        const at = Date.now();
        for (const other of others) {
          send(other.socket, { t: "envelope", id, from: member.id, fromName: member.name, fromRole: member.role, envelope, at });
        }
        send(socket, { t: "relayed", id, delivered: others.length > 0, at });
        console.log(`[relay] ${room.id} ${member.name} -> ${others.length} peer(s), seq ${(envelope as { seq?: number }).seq}`);
        return;
      }

      if (msg.t === "ack") {
        const id = String(msg.id ?? "");
        const at = Date.now();
        for (const other of room.members.values()) {
          if (other.id === member.id) continue;
          send(other.socket, { t: "ack", id, from: member.name, at });
        }
        return;
      }

      if (msg.t === "ping") return send(socket, { t: "pong" });
    },

    close(socket) {
      const data = socket.data as SocketData;
      if (!data.roomId || !data.memberId) return;
      const room = rooms.get(data.roomId);
      if (!room) return;
      room.members.delete(data.memberId);
      presence(room);
      if (room.members.size === 0) {
        // keep it around briefly so a refresh rejoins the same room
        setTimeout(() => {
          const current = rooms.get(room.id);
          if (current && current.members.size === 0) rooms.delete(room.id);
        }, 10 * 60 * 1000);
      }
    },
  },
});

console.log(`relay listening on http://127.0.0.1:${server.port}  (websocket /ws, rooms: ${rooms.size})`);
