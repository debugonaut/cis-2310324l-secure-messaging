import { motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRoute } from "../lib/router";
import { useSession } from "../lib/session";
import { Button, Card, ConnectionDot, CopyButton, Eyebrow, Spinner, cx } from "../components/ui";

export default function CreateRoom() {
  const { createRoom, adoptRoom, session, participants, connection, leaveRoom } = useSession();
  const { navigate } = useRoute();
  const [roomId, setRoomId] = useState<string | null>(session?.role === "alice" ? session.roomId : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (session?.role === "alice") return;

    setBusy(true);
    createRoom()
      .then((room) => {
        adoptRoom(room, "alice", "Alice");
        setRoomId(room.id);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not create the room."))
      .finally(() => setBusy(false));
  }, [adoptRoom, createRoom, session]);

  const inviteLink = roomId ? `${window.location.origin}${window.location.pathname}#/join/${roomId}` : "";
  const bob = participants.find((p) => p.role === "bob");

  const startOver = async () => {
    leaveRoom();
    setRoomId(null);
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
      adoptRoom(room, "alice", "Alice");
      setRoomId(room.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell flex min-h-[calc(100vh-8rem)] items-start justify-center pb-16 pt-14 sm:items-center sm:pt-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
            <Eyebrow>Room</Eyebrow>
            <ConnectionDot online={connection === "online"} label={connection === "online" ? "Connected" : "Connecting"} />
          </div>

          <div className="px-6 py-6">
            {busy && !roomId ? (
              <div className="flex items-center gap-2 text-[15px] text-ink-soft">
                <Spinner /> Creating room…
              </div>
            ) : error ? (
              <div className="rounded-[10px] border border-danger/20 bg-danger-soft px-3.5 py-3 text-[15px] text-danger">
                {error}
              </div>
            ) : roomId ? (
              <>
                <p className="text-[26px] font-medium tracking-[0.1em] text-ink">{roomId}</p>

                <div className="mt-5 flex items-center gap-2">
                  <code className="tech min-w-0 flex-1 truncate rounded-[9px] border border-line bg-sand/60 px-3 py-2.5 text-[14px] text-ink-soft">
                    {inviteLink}
                  </code>
                  <CopyButton value={inviteLink} />
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-line-soft pt-5">
                  <li className="flex items-center justify-between text-[15px]">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Alice <span className="text-muted">(you)</span>
                    </span>
                    <span className="text-[13px] text-muted">Connected</span>
                  </li>
                  <li className="flex items-center justify-between text-[15px]">
                    <span className="flex items-center gap-2 text-ink">
                      <span className={cx("h-1.5 w-1.5 rounded-full", bob ? "bg-success" : "bg-muted/50")} />
                      Bob
                    </span>
                    <span className="text-[13px] text-muted">{bob ? "Connected" : "Waiting"}</span>
                  </li>
                </ul>

                <div className="mt-6 flex items-center gap-3">
                  <Button onClick={() => navigate("/setup")} disabled={!bob}>
                    {bob ? "Continue" : "Waiting for Bob"}
                    {bob ? <ArrowRight size={15} /> : <Spinner className="text-cream/70" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={startOver}>
                    <RefreshCw size={13} /> New room
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
