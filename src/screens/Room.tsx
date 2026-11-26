import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Lock, RotateCcw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useRoute } from "../lib/router";
import { useSession, type Message } from "../lib/session";
import { Badge, Brand, Button, Card, ConnectionDot, Eyebrow, ResetButton, Spinner, TextArea, cx } from "../components/ui";

export default function Room() {
  const { session, keys, connection, peerName, peerOnline, keyState, leaveRoom } = useSession();
  const { navigate } = useRoute();

  if (!session) {
    return (
      <Note title="No room" action={<Button onClick={() => navigate("/")}>Start</Button>} />
    );
  }

  if (!keys) {
    return (
      <Note
        title={keyState === "deriving" ? "Deriving keys…" : "Session locked"}
        action={<Button onClick={() => navigate("/setup")}>Set up session</Button>}
      />
    );
  }

  const isSender = session.role === "alice";

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="border-b border-line bg-cream/85">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-4">
            <Brand />
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[14px] text-ink-soft sm:inline-flex">
              <span className="tech tracking-[0.08em] text-ink">{session.roomId}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[14px] text-ink-soft sm:inline">{session.name}</span>
            <ConnectionDot online={peerOnline} label={peerName} />
            <button
              type="button"
              onClick={() => {
                leaveRoom();
                navigate("/");
              }}
              className="text-[14px] text-muted transition hover:text-ink"
            >
              Leave
            </button>
            <ResetButton
              onReset={() => {
                leaveRoom();
                navigate("/", { replace: true });
              }}
            />
          </div>
        </div>
      </div>

      <div className="shell max-w-3xl py-8 sm:py-12">
        {isSender ? <SenderDesk /> : <ReceiverDesk />}
        <p className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted">
          {connection === "online" ? "Relay connected" : "Reconnecting…"} · AES-256-CBC · HMAC-SHA256
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sender                                                              */
/* ------------------------------------------------------------------ */

function SenderDesk() {
  const {
    session,
    messages,
    peerOnline,
    peerName,
    tamperNext,
    setTamperNext,
    replayLast,
    openPipeline,
    sendSecure,
    verifyIncoming,
    replayCheck,
    decryptIncoming,
  } = useSession();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replayed, setReplayed] = useState(false);

  const ordered = useMemo(() => [...messages].sort((a, b) => a.at - b.at), [messages]);
  const pending = ordered.filter((m) => m.from === "bob" && m.state === "awaiting");
  const lastOwn = [...ordered].reverse().find((m) => m.from === session?.role);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendSecure(draft);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[26px] font-normal tracking-[-0.02em] text-ink">{peerName}</h1>
        <span className="text-[13px] text-muted">{ordered.length ? `${ordered.length} message${ordered.length === 1 ? "" : "s"}` : ""}</span>
      </div>

      <div className="mt-6 space-y-2.5">
        {ordered.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted">No messages yet.</p>
        ) : (
          ordered.map((message) => (
            <Bubble
              key={message.id}
              message={message}
              mine={message.from === session?.role}
              onInspect={() => openPipeline(message.from === session?.role ? "send" : "inspect", message.id)}
            />
          ))
        )}
      </div>

      {pending.map((message) => (
        <Card key={message.id} className="mt-3 flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-[15px] text-ink">Message received</p>
            <p className="tech mt-0.5 text-[13px] text-muted">#{String(message.seq).padStart(3, "0")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const check = await verifyIncoming(message.id);
                if (!check?.valid) return;
                if (!replayCheck(message.id)?.fresh) return;
                await decryptIncoming(message.id);
              }}
            >
              Decrypt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openPipeline("receive", message.id)}>
              <ArrowRight size={13} />
            </Button>
          </div>
        </Card>
      ))}

      {lastOwn && lastOwn.state === "transmitted" ? (
        <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-soft">
          <Spinner className="text-muted" /> Waiting for {peerName}…
        </p>
      ) : null}

      <div className="mt-6">
        <div className="card-soft overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5">
            <TextArea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void handleSend();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3.5 pt-1">
            <p className="text-[12px] tracking-[0.04em] text-muted">AES-256-CBC · HMAC-SHA256</p>
            <Button onClick={handleSend} disabled={!draft.trim() || sending || !peerOnline}>
              {sending ? <Spinner /> : <Lock size={13} />}
              Send
            </Button>
          </div>
        </div>

        <details className="group mt-3 rounded-[10px] border border-line-soft bg-paper/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-[13px] text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <ShieldAlert size={12} />
            Attack
          </summary>
          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft px-3.5 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink-soft">
              <input
                type="checkbox"
                checked={tamperNext}
                onChange={(event) => setTamperNext(event.target.checked)}
                className="h-3.5 w-3.5 accent-[#895735]"
              />
              Tamper next message
            </label>
            <button
              type="button"
              disabled={!lastOwn || !peerOnline}
              onClick={() => {
                if (!replayLast()) return;
                setReplayed(true);
                window.setTimeout(() => setReplayed(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 text-[14px] text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw size={12} /> Replay last
            </button>
            {replayed ? <span className="text-[13px] text-muted">Replayed</span> : null}
          </div>
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Receiver                                                            */
/* ------------------------------------------------------------------ */

function ReceiverDesk() {
  const {
    session,
    messages,
    openPipeline,
    verifyIncoming,
    replayCheck,
    decryptIncoming,
    sendSecure,
    peerOnline,
    peerName,
  } = useSession();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const ordered = useMemo(() => [...messages].sort((a, b) => a.at - b.at), [messages]);
  const awaiting = ordered.filter((m) => m.state === "awaiting");
  const visible = ordered.filter((m) => m.state !== "awaiting");
  const hasOpened = ordered.some((m) => m.state === "delivered");

  const quickDecrypt = async (id: string) => {
    setBusy(id);
    try {
      const check = await verifyIncoming(id);
      if (!check?.valid) return;
      if (!replayCheck(id)?.fresh) return;
      await decryptIncoming(id);
    } finally {
      setBusy(null);
    }
  };

  const handleReply = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendSecure(draft);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[26px] font-normal tracking-[-0.02em] text-ink">{hasOpened ? "Conversation" : "Inbox"}</h1>
        <ConnectionDot online={peerOnline} label={peerName} />
      </div>

      {awaiting.map((message) => (
        <PendingCard
          key={message.id}
          message={message}
          busy={busy === message.id}
          onOpen={() => openPipeline("receive", message.id)}
          onQuick={() => quickDecrypt(message.id)}
        />
      ))}

      {visible.length > 0 ? (
        <div className="mt-7 space-y-2.5">
          {visible.map((message) => (
            <Bubble
              key={message.id}
              message={message}
              mine={message.from === session?.role}
              onInspect={() => openPipeline(message.from === session?.role ? "send" : "inspect", message.id)}
            />
          ))}
        </div>
      ) : null}

      {visible.length === 0 && awaiting.length === 0 ? (
        <p className="py-14 text-center text-[15px] text-muted">No messages yet.</p>
      ) : null}

      {hasOpened ? (
        <div className="mt-7">
          <div className="card-soft overflow-hidden shadow-[var(--shadow-soft)]">
            <div className="px-4 pt-3.5">
              <TextArea
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Reply"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void handleReply();
                }}
              />
            </div>
            <div className="flex items-center justify-end px-4 pb-3.5 pt-1">
              <Button onClick={handleReply} disabled={!draft.trim() || sending || !peerOnline}>
                {sending ? <Spinner /> : null}
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function PendingCard({
  message,
  busy,
  onOpen,
  onQuick,
}: {
  message: Message;
  busy?: boolean;
  onOpen: () => void;
  onQuick: () => void;
}) {
  const failed = message.state === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className="mt-6"
    >
      <Card className={cx("overflow-hidden", failed && "border-danger/25")}>
        <div className={cx("px-5 py-5", failed && "bg-danger-soft/40")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>
                {failed ? "Rejected" : "Message received"}
              </Eyebrow>
              <p className="mt-2 text-[17px] text-ink">{message.fromName}</p>
            </div>
            <span className={cx("grid h-8 w-8 place-items-center rounded-full border", failed ? "border-danger/20 bg-danger-soft text-danger" : "border-line bg-sand/60 text-ink-soft")}>
              {failed ? <ShieldAlert size={14} /> : <Lock size={14} />}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line-soft pt-3 text-[13px]">
            <div>
              <dt className="text-muted">Seq</dt>
              <dd className="tech mt-0.5 text-[14px] text-ink">#{String(message.seq).padStart(3, "0")}</dd>
            </div>
            <div>
              <dt className="text-muted">Cipher</dt>
              <dd className="mt-0.5 text-[14px] text-ink">AES-256-CBC</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className={cx("mt-0.5 text-[14px]", failed ? "text-danger" : "text-ink-soft")}>
                {failed ? (message.failure?.stage === "replay" ? "Replay" : "Failed") : busy ? "Verifying…" : "Unverified"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onOpen} variant={failed ? "secondary" : "primary"}>
              {failed ? "Inspect" : "Start decryption"}
              <ArrowRight size={14} />
            </Button>
            {!failed ? (
              <Button size="sm" variant="ghost" onClick={onQuick} disabled={busy}>
                {busy ? <Spinner /> : null} Quick verify
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Bubble({ message, mine, onInspect }: { message: Message; mine: boolean; onInspect: () => void }) {
  const failed = message.state === "rejected";
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(message.at);

  return (
    <div className={cx("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[86%] rounded-[12px] border px-4 py-2.5",
          failed
            ? "border-danger/20 bg-danger-soft"
            : mine
              ? "border-line bg-sand/70"
              : "border-line bg-paper shadow-[var(--shadow-soft)]",
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted">{mine ? "You" : message.fromName}</span>
          <span className="text-[12px] text-muted/80">{time}</span>
        </div>

        {failed ? (
          <p className="mt-1 text-[15px] text-danger">
            {message.failure?.stage === "replay" ? "Replay detected" : "Authentication failed"}
          </p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-ink">{message.text}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {failed ? (
            <Badge tone="danger">Rejected</Badge>
          ) : (
            <>
              <Badge tone="neutral">Encrypted</Badge>
              {message.state === "delivered" ? <Badge tone="success">Authenticated</Badge> : null}
              {message.state === "transmitted" || message.state === "delivered" ? <Badge tone="neutral">Delivered</Badge> : null}
            </>
          )}
          {message.tampered ? <Badge tone="danger">Modified</Badge> : null}
          <button
            type="button"
            onClick={onInspect}
            className="ml-1 inline-flex items-center gap-0.5 text-[13px] text-muted transition hover:text-brown"
          >
            Inspect
            <ArrowUpRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Note({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="shell flex min-h-[calc(100vh-8rem)] items-center justify-center pb-20">
      <Card className="px-7 py-7 text-center">
        <p className="text-[18px] text-ink">{title}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </Card>
    </div>
  );
}
