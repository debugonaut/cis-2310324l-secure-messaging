import gsap from "gsap";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lock, Server, Unlock } from "lucide-react";
import { useEffect, useRef } from "react";
import { cx, Mono } from "./ui";

const HEX = "0123456789abcdef";

/**
 * GSAP-driven scramble: ciphertext "materialises" from random hex into the real
 * bytes. The value shown is always the real value once the tween settles.
 */
export function ScrambleText({
  value,
  className,
  duration = 1.2,
  active = true,
  start,
}: {
  value: string;
  className?: string;
  duration?: number;
  active?: boolean;
  start?: string;
}) {
  const node = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = node.current;
    if (!element) return;

    if (!active || reduced) {
      element.textContent = value;
      return;
    }

    const from = start ?? "";
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        const resolved = Math.floor(proxy.p * value.length);
        let out = value.slice(0, resolved);
        for (let i = resolved; i < value.length; i += 1) {
          const source = from[i] ?? HEX[Math.floor(Math.random() * HEX.length)];
          out += i % 3 === 0 ? source : HEX[Math.floor(Math.random() * HEX.length)];
        }
        element.textContent = out;
      },
      onComplete: () => {
        element.textContent = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, active, duration, reduced, start]);

  return <span ref={node} className={className} aria-label={value} />;
}

/**
 * Sender → relay → receiver journey. GSAP moves a single envelope token along
 * the wire; the nodes stay static so the motion reads as one message in transit.
 */
export function PacketJourney({
  play,
  delivered,
  fromName,
  toName,
}: {
  play: boolean;
  delivered: boolean;
  fromName: string;
  toName: string;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const token = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const trackEl = track.current;
    const tokenEl = token.current;
    if (!trackEl || !tokenEl) return;

    const travel = () => trackEl.clientWidth - tokenEl.clientWidth - 8;

    if (reduced) {
      gsap.set(tokenEl, { x: delivered ? travel() : travel() / 2, opacity: 1 });
      return;
    }

    if (!play) {
      gsap.set(tokenEl, { x: 0, opacity: 1 });
      return;
    }

    const timeline = gsap.timeline();
    timeline.fromTo(tokenEl, { x: 0, opacity: 1 }, { x: travel() / 2, duration: 0.85, ease: "power2.inOut" });
    timeline.to(tokenEl, { x: travel(), duration: 0.95, ease: "power2.inOut" });

    return () => {
      timeline.kill();
    };
  }, [play, delivered, reduced]);

  return (
    <div className="rounded-[12px] border border-line bg-paper p-4">
      <div ref={track} className="relative">
        <div className="flex items-center justify-between gap-2">
          <Node icon={<Lock size={14} />} title={fromName} caption="locks it" />
          <Node icon={<Server size={14} />} title="Courier" caption="sees gibberish" muted />
          <Node icon={<Unlock size={14} />} title={toName} caption="opens it" />
        </div>
        <div className="pointer-events-none absolute left-8 right-8 top-[18px] h-px bg-line" />
        <div
          ref={token}
          className="pointer-events-none absolute left-8 top-[10px] flex h-[17px] w-[28px] items-center justify-center rounded-[4px] border border-brown/40 bg-brown/10"
          aria-hidden
        >
          <span className="h-[7px] w-[7px] rounded-[2px] bg-brown" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[14px] text-ink-soft">
        <ArrowRight size={13} className="text-muted" />
        {delivered ? "The box arrived. Bob has not opened it yet." : "The box is on its way."}
      </div>
    </div>
  );
}

function Node({
  icon,
  title,
  caption,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  muted?: boolean;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-1 bg-paper px-2">
      <span
        className={cx(
          "grid h-9 w-9 place-items-center rounded-full border",
          muted ? "border-line bg-sand text-ink-soft" : "border-brown/25 bg-brown/8 text-brown",
        )}
      >
        {icon}
      </span>
      <span className="text-[14px] font-medium text-ink">{title}</span>
      <span className="text-[12px] uppercase tracking-[0.1em] text-muted">{caption}</span>
    </div>
  );
}

/** Two authentication tags side by side; the verdict is computed, never animated in. */
export function TagCompare({
  match,
  received,
  computed,
}: {
  match: boolean;
  received: string;
  computed: string;
}) {
  const reduced = useReducedMotion();
  const tags = [
    { label: "Received tag", value: received },
    { label: "Recomputed tag", value: computed },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {tags.map((tag, index) => (
        <motion.div
          key={tag.label}
          initial={reduced ? false : { opacity: 0, x: index === 0 ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
          className="rounded-[11px] border border-line bg-paper px-3.5 py-3"
        >
          <p className="text-[12px] uppercase tracking-[0.12em] text-muted">{tag.label}</p>
          <Mono className="mt-1.5 block break-all text-[13px] leading-5">{tag.value}</Mono>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[13px] text-ink-soft">HMAC-SHA256 · 256 bit</span>
            <span
              className={cx(
                "ml-auto rounded-full px-2 py-0.5 text-[12px] font-medium",
                match ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
              )}
            >
              {match ? "match" : "differs"}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** A quiet horizontal progress line used by the wizards. */
export function ProgressLine({ ratio, className }: { ratio: number; className?: string }) {
  return (
    <div className={cx("h-[3px] w-full overflow-hidden rounded-full bg-line", className)}>
      <div className="h-full rounded-full bg-brown transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
    </div>
  );
}
