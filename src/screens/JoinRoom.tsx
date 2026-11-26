import { motion } from "framer-motion";
import { ArrowRight, Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRoute } from "../lib/router";
import { useSession, type Participant } from "../lib/session";
import { Button, Card, Eyebrow, Field, Input, Spinner } from "../components/ui";

interface RoomPreview {
  id: string;
  salt: string;
  createdAt: number;
  participants: Participant[];
}

function extractRoomId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/join\/([A-Za-z0-9]{4,12})/);
  if (match) return match[1].toUpperCase();
  return trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-6);
}

export default function JoinRoom({ roomId: roomIdProp }: { roomId?: string }) {
  const { joinRoom } = useSession();
  const { navigate } = useRoute();
  const [code, setCode] = useState(roomIdProp ?? "");
  const [name, setName] = useState("Bob");
  const [room, setRoom] = useState<RoomPreview | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "joining" | "error">(
    roomIdProp ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (id: string) => {
    if (!id) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(id)}`);
      if (res.status === 404) throw new Error("Room not found.");
      if (!res.ok) throw new Error("Relay unavailable.");
      setRoom((await res.json()) as RoomPreview);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the room.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (roomIdProp) {
      setCode(roomIdProp);
      void lookup(roomIdProp);
    }
  }, [roomIdProp, lookup]);

  const handleJoin = async () => {
    if (!room) return;
    setStatus("joining");
    setError(null);
    try {
      await joinRoom(room.id, name.trim() || "Bob");
      navigate("/setup");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the room.");
      setStatus("error");
    }
  };

  const alice = room?.participants.find((p) => p.role === "alice");

  return (
    <div className="shell flex min-h-[calc(100vh-8rem)] items-start justify-center pb-16 pt-14 sm:items-center sm:pt-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden">
          <div className="border-b border-line-soft px-6 py-4">
            <Eyebrow>Invitation</Eyebrow>
          </div>

          <div className="px-6 py-6">
            {!roomIdProp ? (
              <div className="flex items-end gap-2">
                <Field label="Room code" className="flex-1">
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="K7F2QP"
                    autoComplete="off"
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const id = extractRoomId(code);
                        setCode(id);
                        void lookup(id);
                      }
                    }}
                  />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const id = extractRoomId(code);
                    setCode(id);
                    void lookup(id);
                  }}
                >
                  <Link2 size={14} />
                </Button>
              </div>
            ) : null}

            {status === "loading" ? (
              <div className="mt-4 flex items-center gap-2 text-[15px] text-ink-soft">
                <Spinner /> Loading room…
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-[10px] border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[15px] text-danger">
                {error}
              </p>
            ) : null}

            {room && status !== "error" ? (
              <div className="mt-4">
                <div className="flex items-baseline justify-between border-b border-line-soft pb-4">
                  <span className="text-[24px] font-medium tracking-[0.1em] text-ink">{room.id}</span>
                  <span className="text-[13px] text-muted">
                    Alice · {alice ? "connected" : "waiting"}
                  </span>
                </div>

                <div className="mt-5">
                  <Field label="Your name">
                    <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} />
                  </Field>
                </div>

                <Button className="mt-5" onClick={handleJoin} disabled={status === "joining"}>
                  {status === "joining" ? <Spinner /> : null}
                  Join Room
                  <ArrowRight size={15} />
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
