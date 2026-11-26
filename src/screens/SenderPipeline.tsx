import { useEffect, useRef, useState } from "react";
import { formatBytes, shortHex } from "../lib/crypto";
import { useSession } from "../lib/session";
import { Badge, Button, TechDetails, TechRow, cx } from "../components/ui";
import { CipherPress, KeyThreads, NoteWrite, ParcelRoute, WaxSealPress } from "../components/step-animations";
import { WizardFrame } from "../components/wizard";

const STEPS = [
  {
    label: "Note",
    points: [
      "You type your plain, readable message inside your browser tab.",
      "Your browser encodes the text into UTF-8 bytes and assigns the next sequence number (#seq).",
      "Nothing is encrypted or sent yet — the relay server cannot see this note.",
    ],
  },
  {
    label: "Two keys",
    points: [
      "Your shared passphrase and the room's 16-byte salt run through PBKDF2-SHA256 (210,000 rounds).",
      "The 512-bit output is split into two separate 256-bit keys: K_enc (for locking) and K_mac (for sealing).",
      "Both Alice and Bob compute the exact same keys locally — neither the passphrase nor keys ever leave the tab.",
    ],
  },
  {
    label: "Press",
    points: [
      "A fresh 16-byte random IV is created so even identical messages produce completely different ciphertext.",
      "PKCS#7 padding rounds the plaintext up to a whole multiple of 16-byte AES blocks.",
      "AES-256-CBC encrypts each block chained to the one before it using K_enc.",
    ],
  },
  {
    label: "Seal",
    points: [
      "Your browser packs version, sequence number, IV, and ciphertext together in fixed order.",
      "HMAC-SHA256 signs that whole package with K_mac to create a unique 32-byte authentication tag.",
      "Changing even a single bit later anywhere in the envelope will break this tag.",
    ],
  },
  {
    label: "Send",
    points: [
      "Only the encrypted envelope (version, seq, IV, ciphertext, tag) is sent over WebSocket — zero plaintext.",
      "If Tamper next message was ticked, 1 bit in the ciphertext is flipped before sending to simulate an attacker.",
      "The honest relay forwards the sealed parcel to Bob without being able to read it.",
    ],
  },
];

export default function SenderPipeline({ messageId }: { messageId: string }) {
  const { messages, session, keys, transmit, closePipeline, peerName } = useSession();
  const message = messages.find((m) => m.id === messageId);
  const [step, setStep] = useState(0);
  const transmitted = useRef<string | null>(null);

  useEffect(() => {
    if (step !== 4 || !message) return;
    if (transmitted.current === message.id) return;
    if (message.state === "sealed") {
      transmitted.current = message.id;
      transmit(message.id);
    }
  }, [step, message, transmit]);

  if (!message || !message.envelope || !message.meta || !session) return null;

  const envelope = message.envelope;
  const meta = message.meta;
  const recipient = session.role === "alice" ? peerName : "Alice";

  return (
    <WizardFrame
      eyebrow={`${session.name} · sending`}
      title="Sealing your message"
      roomId={session.roomId}
      steps={STEPS}
      step={step}
      onStep={setStep}
      onExit={closePipeline}
      lastLabel="Done"
      autoDelay={3800}
    >
      {step === 0 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">The note</h2>
            <Badge tone="neutral">plaintext</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            This is what you typed. Anyone who sees the paper can read it.
          </p>
          <div className="mt-5">
            <NoteWrite text={message.text ?? ""} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{new TextEncoder().encode(message.text ?? "").length} bytes</Badge>
            <Badge tone="neutral">Local only</Badge>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">One password, two keys</h2>
            <Badge tone="neutral">PBKDF2</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The shared password unwinds into two keys. One locks the note; the other makes the seal.
          </p>
          <div className="mt-5">
            <KeyThreads fingerprint={keys?.fingerprint} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">The press</h2>
            <Badge tone="neutral">AES-256-CBC</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The press turns the note into blocks of gibberish. Each block is tied to the one before, so the same words
            never print the same pattern.
          </p>
          <div className="mt-5">
            <CipherPress cipherHex={meta.ctHex} ivHex={meta.ivHex} text={message.text ?? ""} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Fact label="IV" value={`${shortHex(meta.ivHex, 10, 4)} · 16 B`} />
            <Fact label="Ciphertext" value={formatBytes(meta.ctBytes)} />
            <Fact label="Padding" value={`PKCS#7 · ${meta.paddingBytes} B`} />
          </div>

          <div className="mt-3">
            <TechDetails title="Details">
              <TechRow label="IV" value={meta.ivHex} />
              <TechRow label="Ciphertext" value={meta.ctHex} />
              <TechRow label="Time" value={`${meta.encryptMs.toFixed(2)} ms`} />
            </TechDetails>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">The seal</h2>
            <Badge tone="neutral">HMAC-SHA256</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            A comb reads the whole box and presses its pattern into wax. Change one character inside, and the pattern
            comes out different.
          </p>
          <div className="mt-5">
            <WaxSealPress macHex={meta.macHex} seq={envelope.seq} />
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Chip label="ver" value="01" />
            <Chip label="seq" value={String(envelope.seq).padStart(3, "0")} />
            <Chip label="IV" value={shortHex(meta.ivHex, 6, 4)} />
            <Chip label="ct" value={`${meta.ctBytes} B`} />
          </div>

          <div className="mt-3">
            <TechDetails title="Details">
              <TechRow label="Tag" value={meta.macHex} />
              <TechRow label="MAC input" value={meta.macInputHex} />
            </TechDetails>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">The hand-off</h2>
            <Badge tone="neutral">transmission</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The relay passes the parcel along. It can see the number and the wax — never the note.
          </p>
          <div className="mt-5">
            <ParcelRoute
              delivered={message.state !== "sealed"}
              fromName={session.name}
              toName={recipient}
              seq={envelope.seq}
            />
          </div>

          <dl className="mt-3 grid gap-x-5 gap-y-1.5 rounded-[11px] border border-line bg-paper px-4 py-3 sm:grid-cols-2">
            <Row label="Ciphertext" value={formatBytes(meta.ctBytes)} />
            <Row label="IV" value={`${shortHex(meta.ivHex, 10, 4)}`} mono />
            <Row label="Seq" value={`#${String(envelope.seq).padStart(3, "0")}`} mono />
            <Row label="Tag" value={`${shortHex(meta.macHex, 10, 4)}`} mono />
          </dl>

          <div
            className={cx(
              "mt-3 rounded-[10px] border px-3.5 py-2.5 text-[14px]",
              message.state === "delivered" || message.state === "transmitted"
                ? "border-success/20 bg-success-soft text-success"
                : "border-line bg-sand/50 text-ink-soft",
            )}
          >
            {message.state === "delivered"
              ? "Delivered and verified"
              : message.state === "transmitted"
                ? "On its way"
                : "Transmitting…"}
          </div>

          {message.state === "sealed" ? (
            <Button size="sm" className="mt-3" onClick={() => transmit(message.id)}>
              Transmit
            </Button>
          ) : null}

          {message.tampered ? <p className="mt-2 text-[13px] text-danger">Ciphertext modified · verification will fail</p> : null}
        </div>
      ) : null}
    </WizardFrame>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] border border-line-soft bg-sand/40 px-3 py-2">
      <p className="text-[12px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-0.5 break-all font-mono text-[13px] text-ink">{value}</p>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-[12px] text-ink">{value}</span>
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={cx("break-all text-right text-[13px] text-ink", mono && "tech")}>{value}</dd>
    </div>
  );
}
