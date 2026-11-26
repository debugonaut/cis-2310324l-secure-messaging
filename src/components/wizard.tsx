import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Eyebrow, Stepper, type Step } from "./ui";
import { ProgressLine } from "./visuals";

export function StageHeading({ title, body, meta }: { title: string; body: string; meta?: ReactNode }) {
  return (
    <div>
      <h2 className="text-[20px] font-normal tracking-[-0.02em] text-ink sm:text-[22px]">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{body}</p>
      {meta ? <div className="mt-3">{meta}</div> : null}
    </div>
  );
}

/** Full-screen wizard chrome: header, stepper, stage card, transport controls. */
export function WizardFrame({
  eyebrow,
  title,
  roomId,
  steps,
  step,
  onStep,
  onExit,
  children,
  canAdvance = true,
  blocked,
  lastLabel,
  onLast,
  autoDelay = 4200,
}: {
  eyebrow: string;
  title: string;
  roomId: string;
  steps: Step[];
  step: number;
  onStep: (index: number) => void;
  onExit: () => void;
  children: ReactNode;
  canAdvance?: boolean;
  blocked?: number[];
  lastLabel?: string;
  onLast?: () => void;
  autoDelay?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const last = steps.length - 1;
  const activeStep = steps[step];
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  useEffect(() => {
    if (!playing || reduced) return;
    if (!canAdvance) {
      setPlaying(false);
      return;
    }
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => stepRef.current(step + 1), autoDelay);
    return () => window.clearTimeout(timer);
  }, [playing, step, canAdvance, last, autoDelay, reduced]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-cream">
      <div className="border-b border-line bg-cream/90 backdrop-blur">
        <div className="shell flex h-14 items-center justify-between gap-4">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 text-[14px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft size={14} /> Back to room
          </button>
          <span className="tech hidden text-[13px] text-muted sm:block">Room {roomId}</span>
          <span className="text-[13px] uppercase tracking-[0.14em] text-muted">
            {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="shell max-w-4xl pb-16 pt-8 sm:pt-10">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2.5 text-[30px] font-normal tracking-[-0.03em] text-ink sm:text-[34px]">{title}</h1>

        <div className="mt-7">
          <Stepper steps={steps} current={step} onSelect={(index) => onStep(index)} blocked={blocked} />
          {activeStep?.points?.length ? (
            <div className="mt-3 rounded-[11px] border border-line-soft bg-sand/45 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Step {String(step + 1).padStart(2, "0")} · What happens here
              </p>
              <ul className="mt-2 space-y-1.5">
                {activeStep.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brown/60" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card mt-5 min-h-[380px] px-5 py-6 shadow-[var(--shadow-soft)] sm:px-8 sm:py-8">
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </div>

        <div className="mt-4">
          <ProgressLine ratio={(step + 1) / steps.length} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft size={14} /> Previous
          </Button>

          {step < last ? (
            <Button size="sm" onClick={() => onStep(Math.min(last, step + 1))} disabled={!canAdvance}>
              Next <ChevronRight size={14} />
            </Button>
          ) : (
            <Button size="sm" onClick={onLast ?? onExit}>
              {lastLabel ?? "Finish"} <ChevronRight size={14} />
            </Button>
          )}

          <Button
            size="sm"
            variant={playing ? "secondary" : "ghost"}
            onClick={() => {
              if (step >= last) {
                setPlaying(true);
                onStep(0);
                return;
              }
              setPlaying((value) => !value);
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "Pause" : "Play"}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onStep(0)}>
            <RotateCcw size={13} /> Replay
          </Button>

        </div>
      </div>
    </div>
  );
}
