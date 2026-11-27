import { useEffect, useRef, useState } from "react";
import { formatBytes, fromBase64, shortHex, toHex, type MacCheck } from "../lib/crypto";
import { useSession, type ReplayCheck } from "../lib/session";
import { Badge, TechDetails, TechRow, cx } from "../components/ui";
import {
  ParcelArrival,
  SealMatch,
  SealRecast,
  SequenceLedger,
  UnsealReveal,
} from "../components/step-animations";
import { WizardFrame } from "../components/wizard";

const STEPS = [
  {
    label: "Parcel",
    points: [
      "Envelope Ingestion: Bob's browser receives version, sequence number (#seq), Base64 IV, ciphertext, and HMAC tag from the relay.",
      "Encrypt-then-MAC Security Invariant: Decryption is strictly forbidden before verifying the HMAC tag, stopping padding-oracle attacks.",
      "Pre-Crypto Structural Validation: Verifies envelope format, 16-byte IV length, and non-empty ciphertext aligned to 16-byte AES block multiples.",
    ],
  },
  {
    label: "Bob's seal",
    points: [
      "Canonical Byte Packing: Assembles version (1 B), sequence number (8 B Big-Endian), IV (16 B), and ciphertext into the identical macInput array.",
      "Dedicated Authentication Key (K_mac): Evaluates HMAC-SHA256 using Bob's local K_mac derived independently via PBKDF2 from the shared passphrase.",
      "Deterministic Verification Target: Produces the exact 32-byte (256-bit) digest expected from a genuine sender holding the shared room secret.",
    ],
  },
  {
    label: "Compare",
    points: [
      "Constant-Time Byte Comparison: Evaluates all 32 bytes using bitwise XOR accumulator (diff |= a[i] ^ b[i]) without early exit, eliminating timing side-channels.",
      "Zero-Tolerance Integrity: 0 bits difference proves the envelope came from someone holding K_mac and arrived without a single bit changed.",
      "Immediate Tamper Rejection: Any difference (~128 bits on bit-flip or wrong password) halts execution as 'Authentication failed', blocking AES decryption.",
    ],
  },
  {
    label: "Ledger",
    points: [
      "Why HMAC Alone Cannot Stop Replay: An attacker replaying a captured message (#001) untouched submits a valid HMAC tag that passes Step 02.",
      "Per-Sender Accepted Ledger: Bob checks whether #seq already exists in his acceptedRef list for this sender.",
      "Duplicate Rejection: If the sequence number was already processed, the envelope is immediately rejected with 'Replay detected'.",
      "Tamper-Proof Sequencing: Because #seq is authenticated inside the HMAC tag on Step 02, an attacker cannot modify the counter to bypass the ledger.",
    ],
  },
  {
    label: "Open",
    points: [
      "Safe AES-256-CBC Decryption: crypto.subtle.decrypt reverses Cipher Block Chaining across all 16-byte blocks using K_enc and the message's IV.",
      "PKCS#7 Padding Removal: Web Crypto validates and strips the trailing padding bytes to recover the original UTF-8 payload.",
      "Ledger Commitment: Sequence number #seq is permanently added to Bob's accepted ledger so future re-transmissions are blocked.",
      "Delivery Acknowledgment (ACK): Bob sends an ack frame over WebSocket to notify Alice that her message was verified and delivered.",
    ],
  },
];

export default function ReceiverPipeline({ messageId }: { messageId: string }) {
  const { messages, session, keys, verifyIncoming, replayCheck, decryptIncoming, closePipeline } = useSession();
  const message = messages.find((m) => m.id === messageId);
  const [step, setStep] = useState(0);
  const [maxUnlocked, setMaxUnlocked] = useState(0);
  const [replay, setReplay] = useState<ReplayCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const verified = useRef(false);
  const replayed = useRef(false);
  const decrypted = useRef(false);

  const inspect = Boolean(message?.text);

  useEffect(() => {
    if (!message || step < 1 || message.check || verified.current) return;
    verified.current = true;
    setChecking(true);
    verifyIncoming(message.id).finally(() => setChecking(false));
  }, [step, message, verifyIncoming]);

  useEffect(() => {
    if (!message || step < 3 || replayed.current) return;
    replayed.current = true;
    if (inspect) {
      setReplay({ fresh: true, receivedSeq: message.seq, lastAccepted: null });
      return;
    }
    setReplay(replayCheck(message.id));
  }, [step, message, inspect, replayCheck]);

  useEffect(() => {
    if (!message || step < 4 || decrypted.current) return;
    if (message.text) {
      decrypted.current = true;
      return;
    }
    decrypted.current = true;
    setDecrypting(true);
    decryptIncoming(message.id).finally(() => setDecrypting(false));
  }, [step, message, decryptIncoming]);

  if (!message || !message.envelope || !session || !keys) return null;

  const envelope = message.envelope;
  const check: MacCheck | undefined = message.check;
  const replayFresh = replay?.fresh ?? null;
  const blocked = message.failure;

  let ctPreview = "";
  let sealHex = "";
  try {
    ctPreview = toHex(fromBase64(envelope.ctB64));
    sealHex = toHex(fromBase64(envelope.macB64));
  } catch {
    // isEnvelope() already validated both fields; nothing to do here.
  }

  const canAdvance =
    step === 0 ? true : step === 1 ? Boolean(check) : step === 2 ? Boolean(check?.valid) : step === 3 ? replayFresh === true : false;

  const stepCeiling = Math.max(maxUnlocked, canAdvance ? step + 1 : step);
  const blockedSteps = STEPS.map((_, index) => index).filter((index) => index > stepCeiling);

  const goTo = (index: number) => {
    if (index > stepCeiling) return;
    if (index > maxUnlocked) setMaxUnlocked(index);
    setStep(index);
  };

  return (
    <WizardFrame
      eyebrow={`${session.name} · receiving`}
      title="Opening your message"
      roomId={session.roomId}
      steps={STEPS}
      step={step}
      onStep={goTo}
      onExit={closePipeline}
      canAdvance={canAdvance}
      blocked={blockedSteps}
      lastLabel="Done"
      autoDelay={4400}
    >
      {step === 0 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">The parcel (Untrusted Arrival)</h2>
            <Badge tone="neutral">Encrypt-then-MAC</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Bob receives the opaque envelope over WebSocket marked &apos;Unverified&apos;. Under the Encrypt-then-MAC paradigm, ciphertext is treated as untrusted and held locked until its HMAC authentication tag is verified.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{message.fromName}</Badge>
            <Badge tone="neutral">#{String(message.seq).padStart(3, "0")}</Badge>
            <Badge tone="neutral">Unverified</Badge>
          </div>

          <div className="mt-5">
            <ParcelArrival seq={message.seq} sealHex={sealHex} preview={ctPreview} />
          </div>

          <dl className="mt-3 grid gap-x-5 gap-y-1.5 rounded-[11px] border border-line bg-paper px-4 py-3.5 sm:grid-cols-2">
            <Row label="Ciphertext" value={formatBytes(Math.round((envelope.ctB64.length * 3) / 4))} />
            <Row label="IV" value={shortHex(envelope.ivB64, 10, 4)} mono />
            <Row label="Seq" value={`#${String(envelope.seq).padStart(3, "0")}`} mono />
            <Row label="Tag" value={shortHex(envelope.macB64, 10, 4)} mono />
          </dl>

          <div className="mt-3">
            <TechDetails title="Details">
              <TechRow label="Version" value={`${envelope.v}`} />
              <TechRow label="IV" value={envelope.ivB64} />
              <TechRow label="Ciphertext" value={envelope.ctB64} />
              <TechRow label="Tag" value={envelope.macB64} />
            </TechDetails>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Tag Recomputation (Bob&apos;s Seal)</h2>
            <Badge tone="neutral">HMAC-SHA256</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Practical 08: Bob reconstructs the canonical byte sequence (version ‖ seq ‖ IV ‖ ciphertext) and calculates what the 32-byte HMAC-SHA256 tag should be using his local copy of K_mac.
          </p>

          {checking || !check ? (
            <p className="mt-6 text-[15px] text-ink-soft">Bob is pressing his own seal…</p>
          ) : (
            <>
              <div className="mt-5">
                <SealRecast macHex={check.computedMacHex} />
              </div>

              <div className="mt-3">
                <TechDetails title="Details">
                  <TechRow label="Recomputed" value={check.computedMacHex} />
                  <TechRow label="MAC input" value={shortHex(check.macInputHex, 64, 16)} />
                  <TechRow label="Time" value={`${check.ms.toFixed(2)} ms`} />
                </TechDetails>
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Constant-Time Verification (Compare)</h2>
            <Badge tone="neutral">Bitwise XOR</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Bob compares the arrived tag with his recomputed tag across all 32 bytes in constant time. A bitwise XOR accumulator evaluates all bytes without early exit, eliminating timing side-channels and catching any 1-bit tamper.
          </p>

          {!check ? (
            <p className="mt-6 text-[15px] text-ink-soft">Waiting for the second seal…</p>
          ) : (
            <>
              <div className="mt-5">
                <SealMatch match={check.valid} received={check.receivedMacHex} computed={check.computedMacHex} />
              </div>

              <div className="mt-3">
                <TechDetails title="Details">
                  <TechRow label="Received" value={check.receivedMacHex} />
                  <TechRow label="Recomputed" value={check.computedMacHex} />
                  <TechRow label="Difference" value={`${check.differingBits} bits`} />
                  <TechRow label="Time" value={`${check.ms.toFixed(2)} ms`} />
                </TechDetails>
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Anti-Replay Ledger Check</h2>
            <Badge tone="neutral">Sequence Ledger</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Because a replayed old message still carries a mathematically valid HMAC tag, Bob checks #seq against his accepted ledger. Any previously seen sequence number is immediately rejected as a replay attack.
          </p>

          {!replay ? (
            <p className="mt-6 text-[15px] text-ink-soft">Checking the ledger…</p>
          ) : (
            <div className="mt-5">
              <SequenceLedger
                fresh={replay.fresh}
                receivedSeq={replay.receivedSeq}
                lastAccepted={replay.lastAccepted}
              />
            </div>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-normal text-ink">Authenticated Decryption (AES-256-CBC)</h2>
            <Badge tone="neutral">Practical 03</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            With integrity, authenticity, and freshness verified, Bob decrypts the ciphertext using K_enc and the envelope&apos;s IV in AES-256-CBC mode, strips PKCS#7 padding, and reveals the original UTF-8 plaintext.
          </p>

          {decrypting ? (
            <p className="mt-6 text-[15px] text-ink-soft">Opening…</p>
          ) : message.text ? (
            <>
              <div className="mt-5">
                <UnsealReveal plaintext={message.text} sealHex={sealHex} preview={ctPreview} />
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-success/20 bg-success-soft px-3.5 py-2.5 text-success">
                <span className="text-[15px] font-medium">Delivered</span>
              </div>

              <div className="mt-3">
                <TechDetails title="Details">
                  <TechRow label="Cipher" value="AES-256-CBC" />
                  <TechRow label="IV" value={shortHex(envelope.ivB64, 22, 8)} />
                  <TechRow label="Padding" value="PKCS#7 removed" />
                  <TechRow label="Authentication" value="verified before decryption" />
                </TechDetails>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-[10px] border border-danger/20 bg-danger-soft px-3.5 py-3">
              <p className="text-[15px] font-medium text-danger">
                {blocked?.stage === "replay" ? "Replay detected" : "Decryption blocked"}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </WizardFrame>
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
