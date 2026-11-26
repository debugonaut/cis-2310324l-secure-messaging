import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Copy, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons and badges                                                  */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brown text-cream hover:bg-brown-dark",
  secondary: "border border-line bg-paper text-ink hover:bg-sand",
  ghost: "text-ink-soft hover:bg-sand hover:text-ink",
  danger: "border border-danger/25 bg-danger-soft text-danger hover:border-danger/40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[15px] rounded-[9px] gap-1.5",
  md: "px-4 py-2.5 text-[15px] rounded-[10px] gap-2",
  lg: "px-5 py-3 text-[17px] rounded-[11px] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type BadgeTone = "neutral" | "brown" | "success" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-sand/60 text-ink-soft",
  brown: "border-brown/20 bg-brown/8 text-brown",
  success: "border-success/20 bg-success-soft text-success",
  danger: "border-danger/20 bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({ children, className, soft }: { children: ReactNode; className?: string; soft?: boolean }) {
  return <div className={cx(soft ? "card-soft" : "card", "shadow-[var(--shadow-soft)]", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("tech text-ink", className)}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="mb-2 block text-[14px] font-medium text-ink-soft">{label}</span> : null}
      {children}
      {hint ? <span className="mt-2 block text-[14px] leading-relaxed text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-[10px] border border-line bg-paper px-3.5 py-2.5 text-[17px] text-ink placeholder:text-muted/80",
        "transition-colors duration-150 hover:border-brown/30 focus:border-brown/50 focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full resize-none bg-transparent text-[17px] leading-relaxed text-ink placeholder:text-muted/80 focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} size={15} />;
}

/* ------------------------------------------------------------------ */
/* Copy to clipboard                                                   */
/* ------------------------------------------------------------------ */

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = value;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-paper px-2.5 py-1.5 text-[14px] font-medium text-ink-soft transition hover:border-brown/30 hover:text-ink",
        className,
      )}
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export function ConnectionDot({ online, label }: { online: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-ink-soft">
      <span
        className={cx(
          "relative inline-block h-[7px] w-[7px] rounded-full",
          online ? "bg-success" : "bg-muted/70",
        )}
      >
        {online ? <span className="absolute inset-0 animate-ping rounded-full bg-success/40" /> : null}
      </span>
      {label}
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brown text-cream">
        <ShieldCheck size={16} strokeWidth={1.8} />
      </span>
      <span className="text-[17px] font-medium tracking-[-0.01em] text-ink">Secure Messaging</span>
    </span>
  );
}

export function ResetButton({ onReset, className }: { onReset: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onReset}
      aria-label="Reset everything and start over"
      title="Reset everything and start over"
      className={cx(
        "grid min-h-8 min-w-8 place-items-center rounded-[9px] border border-line bg-paper text-ink-soft transition hover:border-brown/30 hover:bg-sand/60 hover:text-ink",
        className,
      )}
    >
      <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export interface Step {
  label: string;
}

export function Stepper({
  steps,
  current,
  onSelect,
  blocked,
}: {
  steps: Step[];
  current: number;
  onSelect?: (index: number) => void;
  blocked?: number[];
}) {
  return (
    <ol className="flex items-stretch gap-1 overflow-x-auto pb-1 scroll-slim">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const isBlocked = blocked?.includes(index) ?? false;
        const reachable = Boolean(onSelect) && !isBlocked;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect?.(index)}
              className={cx(
                "group flex min-w-0 flex-1 items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition",
                reachable && "hover:bg-sand/70",
                !reachable && "cursor-default",
              )}
            >
              <span
                className={cx(
                  "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[13px] font-medium transition",
                  done && "border-success/30 bg-success-soft text-success",
                  active && "border-brown bg-brown text-cream",
                  !done && !active && "border-line bg-paper text-muted",
                )}
              >
                {done ? <Check size={12} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={cx(
                  "hidden truncate text-[14px] transition sm:block",
                  active ? "font-medium text-ink" : done ? "text-ink-soft" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span className={cx("h-px w-3 shrink-0 sm:w-5", done ? "bg-success/40" : "bg-line")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsible technical details                                       */
/* ------------------------------------------------------------------ */

export function TechDetails({
  title = "Technical details",
  children,
  open,
}: {
  title?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-[11px] border border-line-soft bg-sand/50 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[14px] font-medium text-ink-soft transition hover:text-ink">
        {title}
        <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-line-soft px-3.5 py-3">{children}</div>
    </details>
  );
}

export function TechRow({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1">
      <span className="text-[13px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className={cx("min-w-0 break-all text-right text-[14px] text-ink", mono && "tech")}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

export function Fade({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 0.61, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
