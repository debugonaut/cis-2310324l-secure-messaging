import gsap from "gsap";
import { useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { shortHex } from "../lib/crypto";
import { cx } from "./ui";

/**
 * One silent scene per pipeline stage.
 *
 * The system is physical, not cyber: paper, thread, a printing press, wax,
 * a parcel, a ledger. Each scene is driven by the real values of the message —
 * ciphertext blocks, the derived fingerprint, the actual HMAC, the real
 * sequence numbers — so nothing on screen is decoration standing in for a
 * different result.
 */

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function pad(seq: number) {
  return String(seq).padStart(3, "0");
}

/** Runs a GSAP scene scoped to the component, and yields the final DOM when reduced motion is on. */
function useStage(build: (scope: HTMLElement) => void, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const scope = ref.current;
    if (reduced || !scope) return;
    const ctx = gsap.context(() => build(scope), ref);
    return () => ctx.revert();
    // The build closure is driven by the explicit deps of each scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);

  return { ref, reduced };
}

/** Types with an interval rather than a frame loop, so it survives hidden tabs. */
function useTypedText(text: string, speed = 24, delay = 0) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (reduced) {
      element.textContent = text;
      return;
    }
    element.textContent = "";
    let index = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1;
        element.textContent = text.slice(0, index);
        if (index >= text.length) window.clearInterval(interval);
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, speed, delay, reduced]);

  return ref;
}

function Caret() {
  return (
    <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] animate-pulse bg-brown align-baseline" />
  );
}

/**
 * A deterministic engraving derived from every nibble of a hex string.
 * It is an impression of the value, not a substitute for it: the actual hex is
 * always shown in the seal code / technical details.
 */
function sigilValues(hex: string): number[] {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  return Array.from({ length: 16 }, (_, index) => {
    let sum = 0;
    let count = 0;
    for (let i = index; i < clean.length; i += 16) {
      sum += parseInt(clean[i], 16);
      count += 1;
    }
    return count ? sum / (count * 15) : 0;
  });
}

function Sigil({ hex, size = 44, className }: { hex: string; size?: number; className?: string }) {
  const values = sigilValues(hex);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="21.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      {values.map((value, index) => {
        const angle = (index / values.length) * Math.PI * 2 - Math.PI / 2;
        const inner = 7;
        const outer = 10 + value * 10;
        return (
          <line
            key={index}
            x1={24 + Math.cos(angle) * inner}
            y1={24 + Math.sin(angle) * inner}
            x2={24 + Math.cos(angle) * outer}
            y2={24 + Math.sin(angle) * outer}
            stroke="currentColor"
            strokeWidth={index % 2 === 0 ? 1.5 : 1}
            strokeLinecap="round"
            strokeOpacity={0.55 + value * 0.45}
          />
        );
      })}
      <circle cx="24" cy="24" r="2.2" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

function WaxSeal({ hex, size = 64, className }: { hex: string; size?: number; className?: string }) {
  return (
    <div
      className={cx(
        "relative grid shrink-0 place-items-center rounded-full bg-brown text-cream",
        "shadow-[0_2px_0_rgba(112,67,38,0.35),0_12px_22px_-14px_rgba(112,67,38,0.65)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-[5px] rounded-full border border-cream/25" />
      <Sigil hex={hex} size={size - 16} className="text-cream" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 · Alice — the note, readable only because it is in the open       */
/* ------------------------------------------------------------------ */

export function NoteWrite({ text }: { text: string }) {
  const typed = useTypedText(text, 24);
  const { ref, reduced } = useStage(() => {
    gsap.from(".note-sheet", { y: 16, opacity: 0, duration: 0.65, ease: "power3.out" });
    gsap.from(".note-crop", { opacity: 0, duration: 0.35, stagger: 0.05, delay: 0.4 });
    gsap.fromTo(
      ".note-sweep",
      { xPercent: -100, opacity: 0 },
      { xPercent: 300, opacity: 1, duration: 1.5, delay: 0.45, ease: "power2.inOut" },
    );
  }, [text]);

  return (
    <div ref={ref} className="relative flex justify-center px-1 py-3">
      <div className="note-sheet relative w-full max-w-[520px] rounded-[7px] border border-line bg-paper px-7 py-9 shadow-[0_1px_0_rgba(36,25,20,0.03),0_22px_34px_-30px_rgba(36,25,20,0.4)]">
        {!reduced ? (
          <span className="note-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-brown/[0.07] to-transparent" />
        ) : null}

        <p className="relative min-h-[3.2em] text-[21px] leading-relaxed text-ink sm:text-[24px]">
          <span ref={typed} />
          <Caret />
        </p>

        <span className="note-crop absolute left-3 top-3 h-2.5 w-2.5 border-l border-t border-brown/30" />
        <span className="note-crop absolute right-3 top-3 h-2.5 w-2.5 border-r border-t border-brown/30" />
        <span className="note-crop absolute bottom-3 left-3 h-2.5 w-2.5 border-b border-l border-brown/30" />
        <span className="note-crop absolute bottom-3 right-3 h-2.5 w-2.5 border-b border-r border-brown/30" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Alice — one password unwinds into two differently dyed threads */
/* ------------------------------------------------------------------ */

export function KeyThreads({ fingerprint }: { fingerprint?: string }) {
  const { ref, reduced } = useStage(() => {
    gsap.fromTo(
      ".thread",
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.1, delay: 0.2 },
    );
    gsap.from(".key-spool", { opacity: 0, y: 10, duration: 0.5, stagger: 0.12, delay: 0.75, ease: "power3.out" });
    gsap.from(".braid", { opacity: 0, duration: 0.5, delay: 1.05 });
    gsap.from(".fingerprint", { opacity: 0, duration: 0.4, delay: 1.2 });
  }, [fingerprint]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-7 sm:px-6">
      <div className="relative mx-auto mt-4 h-[86px] w-full max-w-[420px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 90" fill="none" preserveAspectRatio="none" aria-hidden>
          <path
            className="thread"
            d="M210 0 C210 34 105 38 105 90"
            stroke="var(--color-brown)"
            strokeOpacity="0.6"
            strokeWidth="1.2"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={reduced ? 0 : 1}
          />
          <path
            className="thread"
            d="M210 0 C210 34 315 38 315 90"
            stroke="var(--color-brown)"
            strokeOpacity="0.35"
            strokeWidth="1.2"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={reduced ? 0 : 1}
          />
        </svg>
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-paper px-3 py-1 text-[13px] text-ink-soft">
          shared password
        </span>
      </div>

      <div className="mx-auto mt-1 grid max-w-[420px] grid-cols-2 gap-3">
        <div className="key-spool rounded-[10px] border border-brown/25 bg-brown/[0.06] px-3.5 py-3">
          <p className="tech text-[12px] text-brown">K_enc</p>
          <p className="mt-1 text-[15px] leading-snug text-ink">locks the message</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted">AES-256</p>
        </div>
        <div className="key-spool rounded-[10px] border border-line bg-sand/50 px-3.5 py-3">
          <p className="tech text-[12px] text-ink-soft">K_mac</p>
          <p className="mt-1 text-[15px] leading-snug text-ink">makes the seal</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted">HMAC-SHA256</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <svg className="braid text-brown" width="150" height="22" viewBox="0 0 150 22" fill="none" aria-hidden>
          <path d="M2 11 Q 18 1 34 11 T 66 11 T 98 11 T 130 11 T 148 11" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
          <path d="M2 11 Q 18 21 34 11 T 66 11 T 98 11 T 130 11 T 148 11" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
        </svg>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">the same braid on both sides</p>
        <p className="fingerprint tech mt-1 text-[12px] text-muted">{fingerprint ?? "—"}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Alice — the press: note in, chained blocks of gibberish out    */
/* ------------------------------------------------------------------ */

export function CipherPress({ cipherHex, ivHex, text }: { cipherHex: string; ivHex: string; text: string }) {
  const clean = cipherHex.replace(/\s+/g, "");
  const allBlocks = clean.match(/.{1,32}/g) ?? [];
  const blocks = allBlocks.slice(0, 3);
  const extra = allBlocks.length - blocks.length;

  const { ref } = useStage((scope) => {
    const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });
    timeline.from(".press-scene", { opacity: 0, y: 8, duration: 0.4 });
    timeline.to(".note-in", { y: 40, opacity: 0, duration: 0.55, ease: "power2.in" }, 0.35);
    timeline.fromTo(
      ".press-bar",
      { scaleY: 1 },
      { scaleY: 0.86, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" },
      0.85,
    );
    timeline.from(".cipher-tile", { y: -16, opacity: 0, scale: 0.97, duration: 0.45, stagger: 0.17, ease: "power3.out" }, 0.9);
    if (scope.querySelector(".cipher-chain")) {
      timeline.from(".cipher-chain", { scaleX: 0, duration: 0.25, stagger: 0.17 }, 1.05);
    }
    timeline.from(".press-caption", { opacity: 0, duration: 0.4 }, 1.6);
  }, [cipherHex, ivHex]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-6">
      <div className="press-scene relative mx-auto h-[184px] w-full max-w-[460px]">
        <div className="note-in absolute left-1/2 top-0 z-0 w-[218px] max-w-[82%] -translate-x-1/2 rounded-[6px] border border-line bg-paper px-4 py-3 shadow-[0_8px_16px_-14px_rgba(36,25,20,0.5)]">
          <p className="line-clamp-2 text-[13px] leading-snug text-ink-soft">{text}</p>
        </div>

        <div className="press-bar absolute inset-x-0 top-[64px] z-10 h-9 rounded-[8px] border border-line bg-sand/80 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
          <span className="absolute inset-x-4 top-[7px] h-px bg-line" />
          <span className="absolute inset-x-4 bottom-[7px] h-px bg-line" />
          <span className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-brown/35 bg-paper" />
          <span className="absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-brown/35 bg-paper" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper px-2.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            aes press
          </span>
        </div>

        <div className="absolute inset-x-0 top-[116px] flex items-start justify-center gap-1.5 sm:gap-2">
          {blocks.map((chunk, index) => (
            <div key={`${chunk}-${index}`} className="flex items-start gap-1.5 sm:gap-2">
              {index > 0 ? <span className="cipher-chain mt-6 h-px w-2 shrink-0 origin-left bg-brown/30 sm:w-3" /> : null}
              <div className="cipher-tile w-[86px] shrink-0 rounded-[7px] border border-brown/20 bg-brown/[0.05] px-2 py-2 sm:w-[104px]">
                <p className="tech break-all text-[10px] leading-[1.5] text-ink-soft">{chunk}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted">block {index + 1}</p>
              </div>
            </div>
          ))}
          {extra > 0 ? (
            <span className="cipher-tile mt-4 shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-muted">
              +{extra}
            </span>
          ) : null}
        </div>
      </div>

      <p className="press-caption mt-2 text-center font-mono text-[11px] text-muted">
        IV {shortHex(ivHex, 12, 4)} · random start, sent with the box
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Alice — the comb reads the box; its pattern is pressed in wax  */
/* ------------------------------------------------------------------ */

export function WaxSealPress({ macHex, seq }: { macHex: string; seq: number }) {
  const { ref } = useStage(() => {
    const timeline = gsap.timeline();
    timeline.from(".seal-box", { y: 10, opacity: 0, duration: 0.5 });
    timeline.fromTo(
      ".comb",
      { x: -96, y: 2, opacity: 0 },
      { x: 96, y: 30, opacity: 1, duration: 0.8, ease: "power1.inOut" },
      0.25,
    );
    timeline.to(".comb", { opacity: 0, duration: 0.25 }, "+=0.05");
    timeline.fromTo(".wax-pool", { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, "-=0.1");
    timeline.fromTo(
      ".medallion",
      { y: -26, scale: 1.4, opacity: 0, rotate: -8 },
      { y: 0, scale: 1, opacity: 1, rotate: 0, duration: 0.45, ease: "power4.in" },
      "-=0.05",
    );
    timeline.fromTo(".medallion-ring", { scale: 0.9, opacity: 0.6 }, { scale: 1.6, opacity: 0, duration: 0.5 }, "-=0.08");
    timeline.from(".seal-code", { opacity: 0, duration: 0.4 }, "-=0.2");
  }, [macHex, seq]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-6">
      <div className="relative mx-auto h-[188px] w-full max-w-[330px]">
        <div className="seal-box absolute inset-x-0 top-6 rounded-[10px] border border-line bg-sand/40 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">the box</span>
            <span className="tech text-[11px] text-ink-soft">#{pad(seq)}</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <span className="block h-1.5 w-full rounded bg-ink/10" />
            <span className="block h-1.5 w-4/5 rounded bg-ink/10" />
            <span className="block h-1.5 w-3/5 rounded bg-ink/10" />
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 text-brown">
          <div className="comb">
            <svg width="96" height="24" viewBox="0 0 96 24" fill="none" aria-hidden>
              <path d="M4 4h88" stroke="currentColor" strokeOpacity="0.55" />
              {Array.from({ length: 11 }).map((_, index) => (
                <path key={index} d={`M${5 + index * 8.6} 4v14`} stroke="currentColor" strokeOpacity="0.45" />
              ))}
            </svg>
          </div>
        </div>

        <div className="absolute -right-1 bottom-0 z-20">
          <div className="relative grid h-[92px] w-[92px] place-items-center">
            <span className="wax-pool absolute inset-0 rounded-full border border-dashed border-brown/30 bg-brown/10" />
            <span className="medallion-ring pointer-events-none absolute inset-2 rounded-full border border-brown/30" />
            <div className="medallion relative">
              <WaxSeal hex={macHex} size={64} />
            </div>
          </div>
        </div>
      </div>

      <div className="seal-code mt-3 text-center">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted">seal code</p>
        <p className="tech mt-1 break-all text-[12px] leading-4 text-ink">{shortHex(macHex, 48, 12)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Alice — the parcel crosses the relay without being opened      */
/* ------------------------------------------------------------------ */

export function ParcelRoute({
  delivered,
  fromName,
  toName,
  seq,
}: {
  delivered: boolean;
  fromName: string;
  toName: string;
  seq: number;
}) {
  const { ref, reduced } = useStage(
    (scope) => {
      const track = scope.querySelector<HTMLElement>(".route-track");
      const token = scope.querySelector<HTMLElement>(".parcel-token");
      if (!track || !token) return;
      const travel = track.clientWidth - token.clientWidth - 4;

      if (!delivered) {
        gsap.set(token, { x: 0 });
        return;
      }

      gsap.set(token, { x: 0 });
      const timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
      timeline.fromTo(".route-fill", { scaleX: 0 }, { scaleX: 1, duration: 1.85, ease: "power1.inOut" }, 0);
      timeline.to(token, { x: travel / 2, duration: 0.85 }, 0);
      timeline.to(token, { x: travel, duration: 0.95 }, 1);
      timeline.fromTo(".arrival-ring", { scale: 0.6, opacity: 0 }, { scale: 1.7, opacity: 0.9, duration: 0.5, ease: "power2.out" }, 1.9);
      timeline.to(".arrival-ring", { opacity: 0, duration: 0.5 }, 2.3);
    },
    [delivered, seq],
  );

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-6">
      <div className="route-track relative mx-auto h-[112px] w-full max-w-[480px]">
        <span className="absolute inset-x-0 top-[44px] h-px border-t border-dashed border-brown/25" />
        <span
          className={cx(
            "route-fill absolute inset-x-0 top-[44px] h-px origin-left bg-brown/50",
            reduced && !delivered && "opacity-0",
          )}
        />

        <div
          className={cx(
            "parcel-token absolute top-[26px] z-10",
            reduced && delivered ? "right-0" : "left-0",
          )}
        >
          <div className="relative h-[38px] w-[52px] rounded-[7px] border border-brown/35 bg-sand shadow-[0_8px_14px_-12px_rgba(36,25,20,0.6)]">
            <span className="absolute inset-y-0 left-[40%] w-px bg-brown/25" />
            <span className="absolute inset-x-0 top-[52%] h-px bg-brown/25" />
            <span className="absolute left-[40%] top-[52%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brown/40 bg-brown/80" />
            <span className="absolute -right-2 -top-2 rounded-full border border-line bg-paper px-1 text-[9px] font-medium text-ink-soft">
              #{pad(seq)}
            </span>
          </div>
        </div>

        <div className="absolute left-0 top-[68px] z-0">
          <p className="text-[13px] font-medium text-ink">{fromName}</p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">sent</p>
        </div>
        <div className="absolute right-0 top-[68px] z-0 text-right">
          <p className="text-[13px] font-medium text-ink">{toName}</p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">receives</p>
        </div>

        <div className="absolute left-1/2 top-1 z-20 w-[54px] -translate-x-1/2 rounded-[8px] border border-line bg-paper px-1.5 py-2 text-center shadow-[0_6px_12px_-10px_rgba(36,25,20,0.5)]">
          <span className="mx-auto block h-[2px] w-6 rounded bg-brown/40" />
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted">relay</p>
        </div>

        <span className="arrival-ring pointer-events-none absolute right-3 top-[34px] h-7 w-7 rounded-full border border-success/40" />
      </div>

      <p className="mt-1 text-center text-[12px] text-muted">The relay passes it on without opening it.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Bob — the parcel lands, still frosted over                     */
/* ------------------------------------------------------------------ */

export function ParcelArrival({ seq, sealHex, preview }: { seq: number; sealHex: string; preview: string }) {
  const { ref } = useStage(() => {
    gsap.from(".parcel-arrive", { x: 34, y: -8, opacity: 0, rotate: 2, duration: 0.7, ease: "power3.out" });
    gsap.from(".arrival-pane", { opacity: 0, duration: 0.5, delay: 0.25 });
    gsap.from(".arrival-wax", { scale: 0.7, rotate: -12, opacity: 0, duration: 0.5, delay: 0.45, ease: "power3.out" });
    gsap.from(".arrival-chip", { opacity: 0, y: 5, duration: 0.35, stagger: 0.08, delay: 0.6 });
  }, [seq, sealHex, preview]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-7">
      <div className="relative mx-auto w-[324px] max-w-full">
        <div className="parcel-arrive relative rounded-[12px] border border-line bg-sand/40 px-4 py-4 shadow-[0_14px_26px_-24px_rgba(36,25,20,0.5)]">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">sealed</span>
            <span className="tech text-[11px] text-ink-soft">#{pad(seq)}</span>
          </div>

          <div className="arrival-pane relative mt-2.5 h-[56px] overflow-hidden rounded-[6px] border border-line-soft bg-paper/70 px-2 py-1.5">
            <p className="tech break-all text-[10px] leading-[1.5] text-ink-soft/60 blur-[2px]">
              {shortHex(preview, 96, 12)}
            </p>
          </div>

          <span className="absolute inset-y-0 left-[38%] w-px bg-brown/25" />
          <span className="absolute inset-x-0 top-[57%] h-px bg-brown/25" />

          <div className="arrival-wax absolute -bottom-4 -right-3 z-10">
            <WaxSeal hex={sealHex} size={54} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {["locked", "unopened", "number"].map((label) => (
          <span
            key={label}
            className="arrival-chip rounded-full border border-line bg-sand/50 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-muted"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Bob — his own stamp presses a second, independent seal         */
/* ------------------------------------------------------------------ */

export function SealRecast({ macHex }: { macHex: string }) {
  const { ref, reduced } = useStage(() => {
    const timeline = gsap.timeline();
    timeline.from(".stamp", { y: -42, opacity: 0, rotate: -7, duration: 0.5, ease: "power3.in" });
    timeline.to(".stamp", { y: 2, scale: 0.97, duration: 0.12, ease: "power2.in" });
    timeline.fromTo(".wax-pool", { scale: 0.5, opacity: 0 }, { scale: 1.08, opacity: 1, duration: 0.35 }, "-=0.1");
    timeline.fromTo(".recast-seal", { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, "-=0.05");
    timeline.to(".stamp", { y: -30, opacity: 0.9, duration: 0.45, ease: "power2.out" }, "+=0.15");
    timeline.to(".stamp", { opacity: 0, duration: 0.2 });
    timeline.from(".recast-label", { opacity: 0, duration: 0.4 }, "-=0.15");
  }, [macHex]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-7">
      <div className="relative mx-auto h-[148px] w-[220px]">
        <div className="absolute bottom-4 left-1/2 grid h-[92px] w-[92px] -translate-x-1/2 place-items-center">
          <span className="wax-pool absolute inset-0 rounded-full border border-dashed border-brown/30 bg-brown/10" />
          <div className="recast-seal relative">
            <WaxSeal hex={macHex} size={64} />
          </div>
        </div>

        <div className={cx("absolute left-1/2 top-0 -translate-x-1/2", reduced && "hidden")}>
          <div className="stamp text-brown">
            <span className="mx-auto block h-8 w-1.5 rounded-full bg-brown/45" />
            <span className="mt-1 grid h-[58px] w-[58px] place-items-center rounded-full border border-brown/45 bg-sand">
              <Sigil hex={macHex} size={40} />
            </span>
          </div>
        </div>
      </div>

      <p className="recast-label mt-1 text-center text-[11px] uppercase tracking-[0.12em] text-muted">Bob's own seal</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · Bob — two impressions meet                                     */
/* ------------------------------------------------------------------ */

export function SealMatch({
  match,
  received,
  computed,
}: {
  match: boolean;
  received: string;
  computed: string;
}) {
  const { ref, reduced } = useStage(() => {
    const timeline = gsap.timeline();
    timeline.from(".seal-left", { x: -34, rotate: -7, opacity: 0, duration: 0.55, ease: "power3.out" });
    timeline.from(".seal-right", { x: 34, rotate: 7, opacity: 0, duration: 0.55, ease: "power3.out" }, 0);
    timeline.to(".seal-left", { rotate: 0, duration: 0.4, ease: "power2.out" }, 0.45);
    timeline.to(".seal-right", { rotate: 0, duration: 0.4, ease: "power2.out" }, 0.45);

    timeline.fromTo(".scan", { x: 0, opacity: 0 }, { x: 128, opacity: 0.9, duration: 0.55, ease: "power1.inOut" }, 0.15);
    timeline.to(".scan", { opacity: 0, duration: 0.2 }, 0.72);

    if (match) {
      timeline.fromTo(
        ".pair-ring",
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" },
        0.55,
      );
    } else {
      timeline.fromTo(".crack", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3 }, 0.55);
      timeline.to(".seal-left", { x: -8, rotate: -3, duration: 0.12, ease: "power2.out" }, 0.62);
      timeline.to(".seal-right", { x: 8, rotate: 3, duration: 0.12, ease: "power2.out" }, 0.62);
      timeline.to(".seal-left", { x: 0, rotate: 0, duration: 0.35, ease: "power2.out" }, 0.78);
      timeline.to(".seal-right", { x: 0, rotate: 0, duration: 0.35, ease: "power2.out" }, 0.78);
    }

    timeline.from(".verdict", { opacity: 0, y: 4, duration: 0.35 }, 0.85);
  }, [match, received, computed]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-7">
      <div className="relative mx-auto w-[232px]">
        <div className="relative flex items-center justify-center gap-4">
          <div className="seal-left">
            <WaxSeal hex={received} size={64} />
          </div>

          {!match ? (
            <svg
              className="crack pointer-events-none absolute left-1/2 top-0 h-[64px] w-4 -translate-x-1/2"
              viewBox="0 0 16 64"
              fill="none"
              aria-hidden
            >
              <path
                d="M9 0 L5 12 L11 24 L4 38 L10 50 L6 64"
                stroke="var(--color-danger)"
                strokeOpacity="0.65"
                strokeWidth="1.4"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={reduced ? 0 : 1}
              />
            </svg>
          ) : null}

          <span
            className={cx("scan pointer-events-none absolute left-1 top-0 h-[62px] w-px bg-brown/40", reduced && "hidden")}
          />

          <div className="seal-right">
            <WaxSeal hex={computed} size={64} />
          </div>

          <span
            className={cx(
              "pair-ring pointer-events-none absolute -inset-x-3 -inset-y-1 rounded-full border border-brown/30",
              reduced && match ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <div className="mt-2 flex justify-between px-1 text-[10px] uppercase tracking-[0.1em] text-muted">
          <span>arrived</span>
          <span>Bob's</span>
        </div>
      </div>

      <p className={cx("verdict mt-4 text-center text-[15px]", match ? "text-success" : "text-danger")}>
        {match ? "The two seals are identical." : "The two seals are different."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Bob — the ledger of numbers he has already accepted            */
/* ------------------------------------------------------------------ */

export function SequenceLedger({
  fresh,
  receivedSeq,
  lastAccepted,
}: {
  fresh: boolean;
  receivedSeq: number;
  lastAccepted: number | null;
}) {
  const last = lastAccepted ?? 0;
  const recent = last > 0 ? [last - 2, last - 1, last].filter((n) => n > 0) : [];
  const rows = Array.from(new Set([...recent, ...(fresh ? [] : [receivedSeq])])).sort((a, b) => a - b);
  const target = receivedSeq;

  const { ref } = useStage(() => {
    const timeline = gsap.timeline();
    timeline.from(".ledger", { y: 10, opacity: 0, duration: 0.45, ease: "power2.out" });
    timeline.from(".ledger-row", { opacity: 0, y: 4, duration: 0.3, stagger: 0.06 }, 0.15);
    timeline.fromTo(
      ".stamp-token",
      { y: -30, opacity: 0, rotate: -4 },
      { y: 0, opacity: 1, rotate: 0, duration: 0.45, ease: "power3.in" },
      0.55,
    );
    timeline.to(".stamp-token", { scale: 1.05, duration: 0.1, yoyo: true, repeat: 1 }, "+=0.45");

    if (!fresh) {
      timeline.to(".target-row", { x: 2, duration: 0.06, repeat: 5, yoyo: true, ease: "none" }, "-=0.05");
      timeline.fromTo(".duplicate-mark", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.out" }, "<");
    }
    timeline.from(".verdict", { opacity: 0, y: 4, duration: 0.35 }, 1.15);
  }, [fresh, receivedSeq, lastAccepted]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 py-7">
      <div className="mx-auto w-[252px] max-w-full">
        <div className="ledger rounded-[5px] border border-line bg-paper px-5 py-4 shadow-[0_14px_24px_-24px_rgba(36,25,20,0.5)]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">ledger · received</p>
          <ul className="mt-1.5">
            {rows.map((number) => {
              const isTarget = !fresh && number === target;
              return (
                <li
                  key={number}
                  className={cx(
                    "ledger-row relative flex h-[34px] items-center justify-between border-b border-line-soft last:border-0",
                    isTarget && "target-row",
                  )}
                >
                  <span className={cx("tech text-[12px]", isTarget ? "text-danger" : "text-ink-soft")}>#{pad(number)}</span>
                  {isTarget ? (
                    <span className="stamp-token inline-flex items-center rounded-[4px] border border-brown/35 bg-brown/10 px-1.5 py-0.5 text-[10px] font-medium text-brown">
                      #{pad(receivedSeq)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-muted">
                      <Check size={10} className="text-success/70" /> kept
                    </span>
                  )}
                  {isTarget ? <span className="duplicate-mark absolute inset-x-0 top-1/2 h-px origin-left bg-danger/70" /> : null}
                </li>
              );
            })}

            {fresh ? (
              <li className="ledger-row relative flex h-[34px] items-center justify-between border-b border-line-soft last:border-0">
                <span className="h-px w-10 bg-line" />
                <span className="stamp-token inline-flex items-center rounded-[4px] border border-brown/35 bg-brown/10 px-1.5 py-0.5 text-[10px] font-medium text-brown">
                  #{pad(receivedSeq)}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <p className={cx("verdict mt-4 text-center text-[15px]", fresh ? "text-success" : "text-danger")}>
        {fresh ? "A number Bob has never written down." : "This number is already in the ledger."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · Bob — the seal lifts, the wrapping opens, the note is readable */
/* ------------------------------------------------------------------ */

export function UnsealReveal({
  plaintext,
  sealHex,
  preview,
}: {
  plaintext: string;
  sealHex: string;
  preview: string;
}) {
  const typed = useTypedText(plaintext, 20, 720);
  const { ref, reduced } = useStage(() => {
    const timeline = gsap.timeline();
    timeline.from(".open-note", { y: 8, opacity: 0, duration: 0.4, ease: "power2.out" });
    timeline.to(
      ".lift-seal",
      { x: 118, y: 112, rotate: 10, scale: 0.8, duration: 0.8, ease: "power3.inOut" },
      0.15,
    );
    timeline.to(".frost", { yPercent: -104, opacity: 0, duration: 0.7, ease: "power3.inOut" }, 0.5);
    timeline.fromTo(".verified-frame", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.1);
  }, [plaintext, sealHex]);

  return (
    <div ref={ref} className="rounded-[12px] border border-line bg-paper px-4 pb-28 pt-8">
      <div className="relative mx-auto w-[340px] max-w-full">
        <div className="open-note relative overflow-hidden rounded-[8px] border border-line bg-paper px-5 py-6 shadow-[0_18px_30px_-28px_rgba(36,25,20,0.55)]">
          <p className="relative min-h-[3.2em] text-[18px] leading-relaxed text-ink">
            <span ref={typed} />
            <Caret />
          </p>

          <span className="absolute left-2.5 top-2.5 h-2 w-2 border-l border-t border-brown/30" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 border-r border-t border-brown/30" />
          <span className="absolute bottom-2.5 left-2.5 h-2 w-2 border-b border-l border-brown/30" />
          <span className="absolute bottom-2.5 right-2.5 h-2 w-2 border-b border-r border-brown/30" />

          {!reduced ? (
            <div className="frost absolute inset-0 bg-sand px-4 py-4">
              <p className="tech break-all text-[10px] leading-[1.6] text-ink-soft/60 blur-[2px]">
                {shortHex(preview, 110, 12)}
              </p>
              <span className="absolute inset-y-0 left-[38%] w-px bg-brown/20" />
              <span className="absolute inset-x-0 top-[58%] h-px bg-brown/20" />
            </div>
          ) : null}
        </div>

        <span className="verified-frame pointer-events-none absolute -inset-1 rounded-[10px] border border-success/25" />

        <div
          className={cx(
            "absolute z-10",
            reduced ? "-bottom-12 -right-2" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
        >
          <div className="lift-seal">
            <WaxSeal hex={sealHex} size={54} />
          </div>
        </div>
      </div>
    </div>
  );
}
