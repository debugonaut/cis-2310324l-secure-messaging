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
      "Plaintext is converted into UTF-8 byte representation (plainBytes) via browser Web Crypto TextEncoder.",
      "A strictly incrementing sequence counter (#seq) is allocated locally to preserve order and prevent replay.",
      "Data stays strictly in client-side memory — zero bytes leave the browser tab or reach the network.",
    ],
  },
  {
    label: "Two keys",
    points: [
      "Passphrase is normalized (Unicode NFKC) and combined with the room's unique 16-byte random salt to prevent precomputed rainbow tables.",
      "PBKDF2-HMAC-SHA256 executes 210,000 rounds to derive 512 bits, making offline brute-force attacks computationally expensive.",
      "512 bits are split into two independent 256-bit non-extractable CryptoKeys: K_enc (AES-CBC) and K_mac (HMAC-SHA256).",
      "Both peers verify identical key derivation locally using a SHA-256 fingerprint without ever transmitting the secret key.",
    ],
  },
  {
    label: "Press",
    points: [
      "A fresh 128-bit (16-byte) cryptographically secure random IV is generated via crypto.getRandomValues() for every message.",
      "PKCS#7 deterministic padding appends 1 to 16 pad bytes so the payload aligns to exact 128-bit AES block boundaries.",
      "Cipher Block Chaining (CBC) XORs each plaintext block with the preceding ciphertext block (C_i = AES_K(P_i ⊕ C_i-1)).",
      "14 rounds of substitution-permutation transformations (SubBytes, ShiftRows, MixColumns, AddRoundKey) run under K_enc.",
    ],
  },
  {
    label: "Seal",
    points: [
      "Canonical macInput buffer is constructed: WIRE_VERSION (1 B) ‖ SEQ (8 B uint64) ‖ IV (16 B) ‖ CIPHERTEXT (N B).",
      "Binds metadata and counter inside the MAC so an attacker cannot tamper with the IV or sequence number unnoticed.",
      "HMAC-SHA256 executes nested hashing with inner pad (0x36) and outer pad (0x5C) using K_mac (RFC 2104).",
      "Outputs a 32-byte (256-bit) tag: due to the avalanche effect, flipping any single bit alters ~50% of the tag bits.",
    ],
  },
  {
    label: "Send",
    points: [
      "Payload is serialized into a 5-field JSON wire envelope: version, sequence counter, Base64 IV, ciphertext, and HMAC tag.",
      "Transmitted over WebSocket (/ws) to the relay server without leaking plaintext, passphrase, or derived keys.",
      "Simulated attack: if 'Tamper next message' is enabled, 1 bit in ctB64 is flipped (^= 0x01) to test MITM detection.",
      "Relay delivers the sealed envelope to Bob and returns a delivery confirmation (relayed) to Alice.",
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
            <h2 className="text-[22px] font-normal text-ink">The note (Plaintext Input)</h2>
            <Badge tone="neutral">plaintext</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Alice enters the message inside the local browser context. Before encryption, the browser encodes the string into UTF-8 bytes and binds an incrementing sequence number (#seq) to guarantee packet ordering.
          </p>
          <div className="mt-5">
            <NoteWrite text={message.text ?? ""} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{new TextEncoder().encode(message.text ?? "").length} bytes</Badge>
            <Badge tone="neutral">Local memory only</Badge>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Key Derivation & Domain Separation</h2>
            <Badge tone="neutral">PBKDF2-SHA256</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Human passphrases lack the 256-bit entropy required for cryptographic security. PBKDF2 stretches the passphrase and a 16-byte random salt across 210,000 iterations to derive 512 bits, split cleanly into dedicated encryption (K_enc) and authentication (K_mac) keys.
          </p>
          <div className="mt-5">
            <KeyThreads fingerprint={keys?.fingerprint} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Symmetric Encryption (AES-256-CBC)</h2>
            <Badge tone="neutral">Practical 03</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Practical 03: The UTF-8 plaintext is padded to 16-byte boundaries with PKCS#7 and encrypted with AES-256 in Cipher Block Chaining (CBC) mode. A fresh random 128-bit IV XORs with the first block, ensuring repeated plaintexts yield totally distinct ciphertexts.
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
            <h2 className="text-[22px] font-normal text-ink">Integrity Seal (HMAC-SHA256)</h2>
            <Badge tone="neutral">Practical 08</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Practical 08: AES hides content but cannot prove whether ciphertext was manipulated in transit. HMAC-SHA256 signs the version, sequence number, IV, and ciphertext under K_mac, generating a 32-byte tamper-evident digital seal (Encrypt-then-MAC).
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
            <h2 className="text-[22px] font-normal text-ink">Relay Transmission (Zero-Knowledge)</h2>
            <Badge tone="neutral">WebSocket /ws</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The opaque cryptographic envelope (version, seq, IV, ciphertext, HMAC tag) is transmitted over WebSocket. The relay server routes the envelope to Bob without ever seeing plain text, passphrases, or secret keys.
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
