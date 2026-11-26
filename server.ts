/**
 * Relay server — Secure Messaging System
 * --------------------------------------
 * A deliberately "honest" relay: it routes room presence and opaque encrypted
 * envelopes. It never receives a passphrase, a key, or a plaintext message.
 *
 * Works with both Node.js (>= 22.18 native TS) and Bun:
 *   node server.ts --port 3001          # relay + static ./dist if built
 *   bun server.ts --port 3001           # relay + static ./dist if built
 *   node server.ts --port 3001 --dev    # relay only, Vite handles the UI
 *
 * HTTP
 *   GET  /api/health           -> { ok, rooms, build }
 *   POST /api/rooms            -> create room { id, salt, createdAt }
 *   GET  /api/rooms/:id        -> room info { id, salt, createdAt, participants }
 *
 * WebSocket  /ws
 *   -> { t: "join", room, name, role }
 *   <- { t: "joined", selfId, room }
 *   <- { t: "presence", participants }
 *   -> { t: "envelope", id, envelope }
 *   <- { t: "envelope", id, from, fromName, fromRole, envelope, at }
 *   -> { t: "ack", id }
 *   <- { t: "ack", id, from, at }
 */

type Role = "alice" | "bob";

interface SocketData {
  memberId?: string;
  roomId?: string;
}

interface RelaySocket {
  send(data: string): void;
  close(): void;
  data: SocketData;
}

interface RoomMember {
  id: string;
  name: string;
  role: Role;
  socket: RelaySocket;
}

interface Room {
  id: string;
  salt: string;
  createdAt: number;
  members: Map<string, RoomMember>;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(flag("port", process.env.PORT || "3001")) || 3001;
const DEV = args.includes("--dev") || process.env.RELAY_DEV === "1";
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENVELOPE_CHARS = 64 * 1024;
const MAX_WS_FRAME_BYTES = 128 * 1024;

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

function sendJson(socket: RelaySocket, payload: unknown) {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    /* socket already closing */
  }
}

function broadcast(room: Room, payload: unknown, exceptId?: string) {
  for (const member of room.members.values()) {
    if (member.id === exceptId) continue;
    sendJson(member.socket, payload);
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

const pruneTimer = setInterval(pruneRooms, 5 * 60 * 1000);
if (typeof pruneTimer === "object" && "unref" in pruneTimer && typeof pruneTimer.unref === "function") {
  pruneTimer.unref();
}

/* ------------------------------------------------------------------ */
/* Shared HTTP API & WebSocket relay logic                             */
/* ------------------------------------------------------------------ */

interface ApiResult {
  status: number;
  body: unknown;
}

function handleApi(method: string, pathname: string, hasBuild: boolean): ApiResult | null {
  if (pathname === "/api/health") {
    return { status: 200, body: { ok: true, rooms: rooms.size, build: hasBuild } };
  }

  if (pathname === "/api/rooms" && method === "POST") {
    let id = newRoomId();
    while (rooms.has(id)) id = newRoomId();
    const room: Room = { id, salt: newSalt(), createdAt: Date.now(), members: new Map() };
    rooms.set(id, room);
    console.log(`[room] created ${id}`);
    return { status: 200, body: publicRoom(room) };
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]{4,12})$/i);
  if (roomMatch) {
    const room = rooms.get(roomMatch[1].toUpperCase());
    if (!room) return { status: 404, body: { error: "room-not-found" } };
    return { status: 200, body: publicRoom(room) };
  }

  if (pathname.startsWith("/api/")) {
    return { status: 404, body: { error: "not-found" } };
  }

  return null;
}

function handleWsMessage(socket: RelaySocket, rawText: string) {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return sendJson(socket, { t: "error", code: "bad-json" });
  }

  const data = socket.data;

  if (msg.t === "join") {
    const roomId = String(msg.room ?? "").toUpperCase();
    const name = String(msg.name ?? "").slice(0, 32).trim() || "Guest";
    const role: Role = msg.role === "bob" ? "bob" : "alice";

    const room = rooms.get(roomId);
    if (!room) return sendJson(socket, { t: "error", code: "room-not-found" });

    const occupant = [...room.members.values()].find((m) => m.role === role);
    if (occupant) {
      // Same role reconnecting (e.g. refresh): take over the slot.
      sendJson(occupant.socket, { t: "replaced" });
      try {
        occupant.socket.close();
      } catch {
        /* ignore */
      }
      room.members.delete(occupant.id);
    }

    if (room.members.size >= 2) return sendJson(socket, { t: "error", code: "room-full" });

    const memberId = crypto.randomUUID();
    room.members.set(memberId, { id: memberId, name, role, socket });
    data.memberId = memberId;
    data.roomId = room.id;

    // Acknowledge the joiner first, then broadcast updated presence.
    sendJson(socket, { t: "joined", selfId: memberId, room: publicRoom(room) });
    presence(room);
    return;
  }

  if (!data.memberId || !data.roomId) return sendJson(socket, { t: "error", code: "not-joined" });
  const room = rooms.get(data.roomId);
  const member = room?.members.get(data.memberId);
  if (!room || !member) return sendJson(socket, { t: "error", code: "not-joined" });

  if (msg.t === "envelope") {
    const envelope = msg.envelope;
    const id = String(msg.id ?? "");
    if (!envelope || typeof envelope !== "object") return sendJson(socket, { t: "error", code: "bad-envelope" });
    if (JSON.stringify(envelope).length > MAX_ENVELOPE_CHARS) {
      return sendJson(socket, { t: "error", code: "envelope-too-large" });
    }

    const others = [...room.members.values()].filter((m) => m.id !== member.id);
    const at = Date.now();
    for (const other of others) {
      sendJson(other.socket, {
        t: "envelope",
        id,
        from: member.id,
        fromName: member.name,
        fromRole: member.role,
        envelope,
        at,
      });
    }
    sendJson(socket, { t: "relayed", id, delivered: others.length > 0, at });
    console.log(`[relay] ${room.id} ${member.name} -> ${others.length} peer(s), seq ${(envelope as { seq?: number }).seq}`);
    return;
  }

  if (msg.t === "ack") {
    const id = String(msg.id ?? "");
    const at = Date.now();
    for (const other of room.members.values()) {
      if (other.id === member.id) continue;
      sendJson(other.socket, { t: "ack", id, from: member.name, at });
    }
    return;
  }

  if (msg.t === "ping") return sendJson(socket, { t: "pong" });
}

function handleWsClose(socket: RelaySocket) {
  const data = socket.data;
  if (!data.roomId || !data.memberId) return;
  const room = rooms.get(data.roomId);
  if (!room) return;
  room.members.delete(data.memberId);
  presence(room);
  if (room.members.size === 0) {
    setTimeout(() => {
      const current = rooms.get(room.id);
      if (current && current.members.size === 0) rooms.delete(room.id);
    }, 10 * 60 * 1000);
  }
}

/* ------------------------------------------------------------------ */
/* Bun runtime adapter                                                 */
/* ------------------------------------------------------------------ */

interface BunFileHandle {
  exists(): Promise<boolean>;
}

interface BunGlobal {
  file(url: URL): BunFileHandle;
  serve(options: {
    port: number;
    hostname: string;
    idleTimeout: number;
    fetch(request: Request, server: { upgrade(req: Request, opts: { data: SocketData }): boolean }): Promise<Response | undefined> | Response | undefined;
    websocket: {
      open(): void;
      message(socket: RelaySocket, raw: string | ArrayBuffer | Uint8Array): void;
      close(socket: RelaySocket): void;
    };
  }): { port: number };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function startBunServer(bun: BunGlobal) {
  const distDir = new URL("./dist/", import.meta.url);
  const hasBuild = await bun.file(new URL("index.html", distDir)).exists();

  const server = bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    idleTimeout: 255,

    async fetch(request, srv) {
      const url = new URL(request.url);
      if (url.pathname === "/ws") {
        const ok = srv.upgrade(request, { data: {} });
        return ok ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }

      const api = handleApi(request.method, url.pathname, hasBuild);
      if (api) return jsonResponse(api.body, api.status);

      if (!hasBuild || DEV) {
        return jsonResponse({ error: "relay running without a build — start Vite for the UI", hint: "npm run dev" }, 404);
      }

      const clean = url.pathname === "/" ? "/index.html" : url.pathname;
      const target = new URL(`.${clean}`, distDir);
      if (!target.pathname.startsWith(distDir.pathname)) return new Response("Forbidden", { status: 403 });

      const file = bun.file(target);
      if (await file.exists()) {
        const immutable = clean.startsWith("/assets/");
        return new Response(file as unknown as BodyInit, {
          headers: immutable ? { "cache-control": "public, max-age=31536000, immutable" } : { "cache-control": "no-cache" },
        });
      }

      return new Response(bun.file(new URL("index.html", distDir)) as unknown as BodyInit, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
      });
    },

    websocket: {
      open() {},
      message(socket, raw) {
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        handleWsMessage(socket, text);
      },
      close(socket) {
        handleWsClose(socket);
      },
    },
  });

  console.log(`relay listening on http://127.0.0.1:${server.port}  (websocket /ws, runtime: bun, rooms: ${rooms.size})`);
}

/* ------------------------------------------------------------------ */
/* Node.js runtime adapter (zero external dependencies)                */
/* ------------------------------------------------------------------ */

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function encodeWsFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

async function startNodeServer() {
  const http = await import("node:http");
  const cryptoNode = await import("node:crypto");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(rootDir, "dist");
  const indexHtmlPath = path.join(distPath, "index.html");

  let hasBuild = false;
  try {
    hasBuild = (await fs.stat(indexHtmlPath)).isFile();
  } catch {
    hasBuild = false;
  }

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const api = handleApi(req.method ?? "GET", reqUrl.pathname, hasBuild);
    if (api) {
      const jsonText = JSON.stringify(api.body);
      res.writeHead(api.status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(jsonText);
      return;
    }

    if (!hasBuild || DEV) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ error: "relay running without a build — start Vite for the UI", hint: "npm run dev" }));
      return;
    }

    const clean = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
    const resolved = path.resolve(distPath, `.${clean}`);
    if (resolved !== distPath && !resolved.startsWith(`${distPath}${path.sep}`)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    try {
      const st = await fs.stat(resolved);
      if (st.isFile()) {
        const ext = path.extname(resolved);
        const immutable = clean.startsWith("/assets/");
        const content = await fs.readFile(resolved);
        res.writeHead(200, {
          "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
          "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        });
        res.end(content);
        return;
      }
    } catch {
      /* fall through to SPA index.html */
    }

    const indexBytes = await fs.readFile(indexHtmlPath);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    });
    res.end(indexBytes);
  });

  server.on("upgrade", (req, tcpSocket) => {
    const reqUrl = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const wsKey = req.headers["sec-websocket-key"];
    if (reqUrl.pathname !== "/ws" || typeof wsKey !== "string") {
      tcpSocket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      tcpSocket.destroy();
      return;
    }

    const accept = cryptoNode
      .createHash("sha1")
      .update(`${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");

    tcpSocket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "\r\n",
      ].join("\r\n"),
    );

    let closed = false;
    const relaySocket: RelaySocket = {
      data: {},
      send(text: string) {
        if (closed || tcpSocket.destroyed) return;
        tcpSocket.write(encodeWsFrame(0x1, Buffer.from(text, "utf8")));
      },
      close() {
        if (closed) return;
        closed = true;
        if (!tcpSocket.destroyed) {
          tcpSocket.write(encodeWsFrame(0x8, Buffer.alloc(0)));
          tcpSocket.end();
        }
      },
    };

    let buffer = Buffer.alloc(0);
    let fragments: Buffer[] = [];
    let fragmentOpcode = 0x1;

    const cleanup = () => {
      if (closed) {
        handleWsClose(relaySocket);
        return;
      }
      closed = true;
      handleWsClose(relaySocket);
    };

    tcpSocket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 2) {
        const b0 = buffer[0];
        const b1 = buffer[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          const bigLen = buffer.readBigUInt64BE(2);
          if (bigLen > BigInt(MAX_WS_FRAME_BYTES)) {
            relaySocket.close();
            return;
          }
          payloadLen = Number(bigLen);
          offset = 10;
        }

        if (payloadLen > MAX_WS_FRAME_BYTES) {
          relaySocket.close();
          return;
        }

        const maskLen = masked ? 4 : 0;
        if (buffer.length < offset + maskLen + payloadLen) return;

        let payload = buffer.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (masked) {
          const mask = buffer.subarray(offset, offset + 4);
          const unmasked = Buffer.allocUnsafe(payloadLen);
          for (let i = 0; i < payloadLen; i += 1) unmasked[i] = payload[i] ^ mask[i & 3];
          payload = unmasked;
        }

        buffer = buffer.subarray(offset + maskLen + payloadLen);

        if (opcode === 0x8) {
          relaySocket.close();
          return;
        }
        if (opcode === 0x9) {
          if (!closed && !tcpSocket.destroyed) tcpSocket.write(encodeWsFrame(0xA, payload));
          continue;
        }
        if (opcode === 0xA) continue;

        if (opcode !== 0x0) {
          fragmentOpcode = opcode;
          fragments = [payload];
        } else {
          fragments.push(payload);
        }

        if (fin) {
          const full = fragments.length === 1 ? fragments[0] : Buffer.concat(fragments);
          fragments = [];
          if (fragmentOpcode === 0x1 || fragmentOpcode === 0x2) {
            handleWsMessage(relaySocket, full.toString("utf8"));
          }
        }
      }
    });

    tcpSocket.on("close", cleanup);
    tcpSocket.on("error", cleanup);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Error: 127.0.0.1:${PORT} is already in use. Stop the other relay process or run with PORT=3005 npm start (or --port 3005).`);
        process.exit(1);
      }
      reject(err);
    });
    server.listen(PORT, "127.0.0.1", () => resolve());
  });
  console.log(`relay listening on http://127.0.0.1:${PORT}  (websocket /ws, runtime: node, rooms: ${rooms.size})`);
}

const maybeBun = (globalThis as { Bun?: BunGlobal }).Bun;
if (maybeBun && typeof maybeBun.serve === "function") {
  await startBunServer(maybeBun);
} else {
  await startNodeServer();
}
