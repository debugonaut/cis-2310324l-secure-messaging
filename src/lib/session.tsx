import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  decryptEnvelope,
  deriveKeys,
  flipCiphertextBit,
  isEnvelope,
  sealMessage,
  verifyMac,
  type Envelope,
  type MacCheck,
  type SessionKeys,
} from "./crypto";

export type Role = "alice" | "bob";
export type Connection = "idle" | "connecting" | "online" | "offline";

export interface Participant {
  name: string;
  role: Role;
}

export interface RoomInfo {
  id: string;
  salt: string;
  createdAt: number;
}

export interface MessageMeta {
  ivHex: string;
  ctHex: string;
  macHex: string;
  macInputHex: string;
  ctBytes: number;
  paddingBytes: number;
  encryptMs: number;
}

export type MessageState = "sealed" | "transmitted" | "awaiting" | "delivered" | "rejected";

export interface Failure {
  stage: "mac" | "replay" | "decrypt";
  detail: string;
}

export interface Message {
  id: string;
  from: Role;
  fromName: string;
  text?: string;
  envelope?: Envelope;
  meta?: MessageMeta;
  seq: number;
  at: number;
  state: MessageState;
  check?: MacCheck;
  failure?: Failure;
  tampered?: boolean;
  deliveredAt?: number;
  processingMs?: number;
}

export interface ReplayCheck {
  fresh: boolean;
  receivedSeq: number;
  lastAccepted: number | null;
}

interface StoredSession {
  roomId: string;
  salt: string;
  role: Role;
  name: string;
}

export interface PipelineState {
  mode: "send" | "receive" | "inspect";
  messageId: string;
}

interface SessionContextValue {
  session: StoredSession | null;
  participants: Participant[];
  connection: Connection;
  roomError: string | null;
  keys: SessionKeys | null;
  keyState: "idle" | "deriving" | "ready" | "error";
  keyError: string | null;
  messages: Message[];
  pipeline: PipelineState | null;
  tamperNext: boolean;
  peerOnline: boolean;
  peerName: string;
  createRoom: () => Promise<RoomInfo>;
  joinRoom: (roomId: string, name: string) => Promise<RoomInfo>;
  adoptRoom: (room: RoomInfo, role: Role, name: string) => void;
  establishKeys: (passphrase: string) => Promise<void>;
  sendSecure: (text: string) => Promise<string | null>;
  transmit: (messageId: string) => void;
  resend: (messageId: string) => void;
  replayLast: () => string | null;
  setTamperNext: (value: boolean) => void;
  verifyIncoming: (messageId: string) => Promise<MacCheck | null>;
  replayCheck: (messageId: string) => ReplayCheck | null;
  decryptIncoming: (messageId: string) => Promise<{ ok: boolean; failure?: Failure }>;
  openPipeline: (mode: PipelineState["mode"], messageId: string) => void;
  closePipeline: () => void;
  leaveRoom: () => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "sms.room.v2";

function readStored(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.roomId || !parsed.salt || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function wsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

/** Local copy of accepted sequence numbers, per sending role. */
type AcceptedMap = Record<Role, number[]>;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStored());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connection, setConnection] = useState<Connection>("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [keys, setKeys] = useState<SessionKeys | null>(null);
  const [keyState, setKeyState] = useState<"idle" | "deriving" | "ready" | "error">("idle");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [tamperNext, setTamperNextState] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const keysRef = useRef<SessionKeys | null>(null);
  const acceptedRef = useRef<AcceptedMap>({ alice: [], bob: [] });
  const verifiedChecksRef = useRef<Map<string, MacCheck>>(new Map());
  const seqRef = useRef<Record<Role, number>>({ alice: 1, bob: 1 });
  const tamperRef = useRef(false);
  const sessionRef = useRef<StoredSession | null>(session);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);
  useEffect(() => {
    tamperRef.current = tamperNext;
  }, [tamperNext]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const patchMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  }, []);

  /* ---------------------------------------------------------------- */
  /* Socket                                                            */
  /* ---------------------------------------------------------------- */

  const sendRaw = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const handleEnvelope = useCallback(
    (msg: Record<string, unknown>) => {
      const envelope = msg.envelope;
      if (!isEnvelope(envelope)) return;
      const fromRole: Role = msg.fromRole === "bob" ? "bob" : msg.fromRole === "alice" ? "alice" : "bob";
      const id = String(msg.id ?? crypto.randomUUID());
      setMessages((current) => {
        if (current.some((m) => m.id === id)) return current;
        const incoming: Message = {
          id,
          from: fromRole,
          fromName: String(msg.fromName ?? (fromRole === "alice" ? "Alice" : "Bob")),
          envelope,
          seq: envelope.seq,
          at: Number(msg.at ?? Date.now()),
          state: "awaiting",
        };
        return [...current, incoming];
      });
    },
    [],
  );

  const connect = useCallback(() => {
    const active = sessionRef.current;
    if (!active) return;

    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;

    setConnection("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl());
    } catch {
      setConnection("offline");
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      socketRef.current = socket;
      setConnection("online");
      setRoomError(null);
      socket.send(JSON.stringify({ t: "join", room: active.roomId, name: active.name, role: active.role }));

      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "ping" }));
      }, 25_000);
    };

    socket.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      switch (msg.t) {
        case "joined": {
          const roomParticipants = (msg.room as { participants?: Participant[] } | undefined)?.participants;
          const list = Array.isArray(msg.participants)
            ? (msg.participants as Participant[])
            : Array.isArray(roomParticipants)
              ? roomParticipants
              : [];
          setParticipants(list);
          setRoomError(null);
          break;
        }
        case "presence":
          setParticipants(Array.isArray(msg.participants) ? (msg.participants as Participant[]) : []);
          break;
        case "envelope":
          handleEnvelope(msg);
          break;
        case "relayed": {
          const id = String(msg.id ?? "");
          if (msg.delivered) patchMessage(id, { state: "transmitted" });
          break;
        }
        case "ack": {
          const id = String(msg.id ?? "");
          patchMessage(id, { state: "delivered", deliveredAt: Number(msg.at ?? Date.now()) });
          break;
        }
        case "replaced":
          socket.close();
          break;
        case "error": {
          const code = String(msg.code ?? "error");
          if (code === "room-not-found") setRoomError("That room no longer exists.");
          if (code === "room-full") setRoomError("This room already has two participants.");
          break;
        }
        default:
          break;
      }
    };

    socket.onclose = () => {
      // A stale socket must never clear a newer connection.
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setConnection("offline");
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      const stillActive = sessionRef.current;
      if (!stillActive) return;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(() => connect(), 1500);
    };

    socket.onerror = () => {
      if (socketRef.current === socket) setConnection("offline");
    };
  }, [handleEnvelope, patchMessage]);

  useEffect(() => {
    if (!session) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }
    connect();
    return () => {
      if (retryRef.current) window.clearTimeout(retryRef.current);
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    };
  }, [session, connect]);

  /* ---------------------------------------------------------------- */
  /* Room lifecycle                                                    */
  /* ---------------------------------------------------------------- */

  const adoptRoom = useCallback((room: RoomInfo, role: Role, name: string) => {
    const next: StoredSession = { roomId: room.id, salt: room.salt, role, name };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    setSessionMeta(next);
    setRoomError(null);
    setPipeline(null);
  }, []);

  const setSessionMeta = (_next: StoredSession) => {
    setParticipants([]);
    setMessages([]);
    setKeys(null);
    setKeyState("idle");
    setKeyError(null);
    acceptedRef.current = { alice: [], bob: [] };
    verifiedChecksRef.current.clear();
    seqRef.current = { alice: 1, bob: 1 };
  };

  const createRoom = useCallback(async (): Promise<RoomInfo> => {
    const res = await fetch("/api/rooms", { method: "POST" });
    if (!res.ok) throw new Error("Could not create a room. Is the relay server running?");
    return (await res.json()) as RoomInfo;
  }, []);

  const joinRoom = useCallback(async (roomId: string, name: string): Promise<RoomInfo> => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId.toUpperCase())}`);
    if (res.status === 404) throw new Error("That invitation code does not match an active room.");
    if (!res.ok) throw new Error("Could not reach the relay server.");
    const room = (await res.json()) as RoomInfo;
    adoptRoom(room, "bob", name);
    return room;
  }, [adoptRoom]);

  const leaveRoom = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    sessionRef.current = null;
    setSession(null);
    setParticipants([]);
    setMessages([]);
    setKeys(null);
    setKeyState("idle");
    setPipeline(null);
    setTamperNextState(false);
    acceptedRef.current = { alice: [], bob: [] };
    verifiedChecksRef.current.clear();
    socketRef.current?.close();
  }, []);

  const resetSession = useCallback(() => {
    setMessages([]);
    acceptedRef.current = { alice: [], bob: [] };
    verifiedChecksRef.current.clear();
    seqRef.current = { alice: 1, bob: 1 };
    setPipeline(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Keys                                                              */
  /* ---------------------------------------------------------------- */

  const establishKeys = useCallback(async (passphrase: string) => {
    const active = sessionRef.current;
    if (!active) throw new Error("No active room.");
    if (!passphrase.trim()) {
      setKeyError("Enter the shared passphrase.");
      setKeyState("error");
      return;
    }
    setKeyState("deriving");
    setKeyError(null);
    try {
      const derived = await deriveKeys(passphrase, active.salt);
      keysRef.current = derived;
      setKeys(derived);
      setKeyState("ready");
    } catch (cause) {
      setKeyError(cause instanceof Error ? cause.message : "Key derivation failed.");
      setKeyState("error");
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Sending                                                           */
  /* ---------------------------------------------------------------- */

  const sendSecure = useCallback(
    async (text: string): Promise<string | null> => {
      const activeSession = sessionRef.current;
      const activeKeys = keysRef.current;
      if (!activeSession || !activeKeys) return null;
      const trimmed = text.trim();
      if (!trimmed) return null;

      const seq = seqRef.current[activeSession.role];
      seqRef.current[activeSession.role] = seq + 1;

      const sealed = await sealMessage(trimmed, activeKeys, seq);
      const id = crypto.randomUUID();

      const message: Message = {
        id,
        from: activeSession.role,
        fromName: activeSession.name,
        text: trimmed,
        envelope: sealed.envelope,
        meta: {
          ivHex: sealed.ivHex,
          ctHex: sealed.ctHex,
          macHex: sealed.macHex,
          macInputHex: sealed.macInputHex,
          ctBytes: sealed.ctBytes,
          paddingBytes: sealed.paddingBytes,
          encryptMs: sealed.encryptMs,
        },
        seq,
        at: Date.now(),
        state: "sealed",
      };

      setMessages((current) => [...current, message]);
      setPipeline({ mode: "send", messageId: id });
      return id;
    },
    [],
  );

  const transmit = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message || !message.envelope) return;

      let envelope = message.envelope;
      const tampered = tamperRef.current;
      if (tampered) envelope = flipCiphertextBit(envelope);

      const sent = sendRaw({ t: "envelope", id: message.id, envelope });
      if (!sent) return;
      patchMessage(message.id, { state: "transmitted", tampered, envelope });
      setTamperNextState(false);
    },
    [patchMessage, sendRaw],
  );

  /** Replay attack: push an already-delivered envelope back through the relay. */
  const resend = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message || !message.envelope) return;
      sendRaw({ t: "envelope", id: crypto.randomUUID(), envelope: message.envelope });
    },
    [sendRaw],
  );

  const replayLast = useCallback((): string | null => {
    const sent = [...messagesRef.current].reverse().find((m) => m.from === sessionRef.current?.role && m.envelope);
    if (!sent) return null;
    sendRaw({ t: "envelope", id: crypto.randomUUID(), envelope: sent.envelope });
    return sent.id;
  }, [sendRaw]);

  const setTamperNext = useCallback((value: boolean) => setTamperNextState(value), []);

  /* ---------------------------------------------------------------- */
  /* Receiving (real verification, real decryption)                     */
  /* ---------------------------------------------------------------- */

  const verifyIncoming = useCallback(async (messageId: string): Promise<MacCheck | null> => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    const activeKeys = keysRef.current;
    if (!message || !message.envelope || !activeKeys) return null;

    const check = await verifyMac(message.envelope, activeKeys);
    verifiedChecksRef.current.set(messageId, check);
    patchMessage(messageId, {
      check,
      ...(check.valid
        ? {}
        : { state: "rejected" as MessageState, failure: { stage: "mac" as const, detail: "Authentication tag does not match the received envelope." } }),
    });
    return check;
  }, [patchMessage]);

  const replayCheck = useCallback((messageId: string): ReplayCheck | null => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    if (!message) return null;
    const accepted = acceptedRef.current[message.from] ?? [];
    const lastAccepted = accepted.length ? Math.max(...accepted) : null;
    const fresh = !accepted.includes(message.seq);
    if (!fresh) {
      patchMessage(messageId, {
        state: "rejected",
        failure: { stage: "replay", detail: `Sequence ${message.seq} was already accepted — duplicate message.` },
      });
    }
    return { fresh, receivedSeq: message.seq, lastAccepted };
  }, [patchMessage]);

  const decryptIncoming = useCallback(
    async (messageId: string): Promise<{ ok: boolean; failure?: Failure }> => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      const activeKeys = keysRef.current;
      if (!message || !message.envelope || !activeKeys) return { ok: false };

      const check = message.check ?? verifiedChecksRef.current.get(messageId);
      if (!check || !check.valid) {
        return { ok: false, failure: { stage: "mac", detail: "Refused to decrypt: MAC verification has not passed." } };
      }
      const accepted = acceptedRef.current[message.from] ?? [];
      if (accepted.includes(message.seq)) {
        return { ok: false, failure: { stage: "replay", detail: "Refused to decrypt: this envelope was already accepted." } };
      }

      try {
        const { plaintext, ms } = await decryptEnvelope(message.envelope, activeKeys);
        acceptedRef.current[message.from] = [...accepted, message.seq];
        patchMessage(messageId, { text: plaintext, state: "delivered", failure: undefined, processingMs: ms });
        sendRaw({ t: "ack", id: message.id });
        return { ok: true };
      } catch {
        const failure: Failure = { stage: "decrypt", detail: "AES-CBC could not remove the padding — the message is not decryptable." };
        patchMessage(messageId, { state: "rejected", failure });
        return { ok: false, failure };
      }
    },
    [patchMessage, sendRaw],
  );

  const openPipeline = useCallback((mode: PipelineState["mode"], messageId: string) => {
    setPipeline({ mode, messageId });
  }, []);

  const closePipeline = useCallback(() => setPipeline(null), []);

  const activeSession = session;
  const peerRole: Role = activeSession?.role === "bob" ? "alice" : "bob";
  const peer = participants.find((p) => p.role === peerRole);
  const peerOnline = Boolean(peer) && connection === "online";

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      participants,
      connection,
      roomError,
      keys,
      keyState,
      keyError,
      messages,
      pipeline,
      tamperNext,
      peerOnline,
      peerName: peer?.name ?? (peerRole === "alice" ? "Alice" : "Bob"),
      createRoom,
      joinRoom,
      adoptRoom,
      establishKeys,
      sendSecure,
      transmit,
      resend,
      replayLast,
      setTamperNext,
      verifyIncoming,
      replayCheck,
      decryptIncoming,
      openPipeline,
      closePipeline,
      leaveRoom,
      resetSession,
    }),
    [
      session,
      participants,
      connection,
      roomError,
      keys,
      keyState,
      keyError,
      messages,
      pipeline,
      tamperNext,
      peer,
      peerRole,
      createRoom,
      joinRoom,
      adoptRoom,
      establishKeys,
      sendSecure,
      transmit,
      resend,
      replayLast,
      setTamperNext,
      verifyIncoming,
      replayCheck,
      decryptIncoming,
      openPipeline,
      closePipeline,
      leaveRoom,
      resetSession,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}
