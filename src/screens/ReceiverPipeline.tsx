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
  { label: "Parcel" },
  { label: "Bob's seal" },
  { label: "Compare" },
  { label: "Ledger" },
  { label: "Open" },
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
            <h2 className="text-[22px] font-normal text-ink">The parcel</h2>
            <Badge tone="neutral">envelope</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            It arrived locked and sealed. Bob can see the number and the wax, not the message.
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
            <h2 className="text-[22px] font-normal text-ink">Bob makes his own seal</h2>
            <Badge tone="neutral">HMAC-SHA256</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            He runs the same recipe over the box with his own copy of the key. Same box, same key: the pattern should
            come out identical.
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
            <h2 className="text-[22px] font-normal text-ink">Two impressions, side by side</h2>
            <Badge tone="neutral">comparison</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The two seals meet. If anything inside changed on the way, the patterns will not line up.
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
            <h2 className="text-[22px] font-normal text-ink">The ledger</h2>
            <Badge tone="neutral">sequence number</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Bob writes down every number he accepts. A number already in the ledger means someone has re-sent an old
            parcel.
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
            <h2 className="text-[22px] font-normal text-ink">The note again</h2>
            <Badge tone="neutral">AES-256-CBC</Badge>
          </div>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            The seal matched, so the key is safe to use. The wrapping opens and the message is readable again.
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
