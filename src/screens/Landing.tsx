import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRoute } from "../lib/router";
import { useSession } from "../lib/session";
import { Button, Eyebrow } from "../components/ui";

const STEPS = ["Encrypt", "Authenticate", "Decrypt"];

export default function Landing() {
  const { navigate } = useRoute();
  const { session } = useSession();
  const reduced = useReducedMotion();

  return (
    <div className="pb-24">
      <section className="shell pt-20 sm:pt-28">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
          className="max-w-3xl"
        >
          <Eyebrow>Cryptography &amp; Information Security</Eyebrow>
          <h1 className="mt-5 text-[38px] font-normal leading-[1.08] tracking-[-0.035em] text-ink sm:text-[50px] md:text-[58px]">
            Messages should be private.
            <br />
            <span className="text-brown">Their integrity should be verifiable.</span>
          </h1>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => navigate("/create")}>
              Create Room
              <ArrowRight size={16} />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/join")}>
              Join Room
            </Button>
          </div>

          {session ? (
            <button
              type="button"
              onClick={() => navigate("/room")}
              className="mt-6 inline-flex items-center gap-1.5 text-[15px] text-ink-soft transition hover:text-ink"
            >
              Rejoin {session.roomId}
              <ArrowRight size={13} />
            </button>
          ) : null}
        </motion.div>
      </section>

      <section className="shell mt-20 sm:mt-28">
        <div className="hairline" />
        <div className="grid gap-8 py-10 sm:grid-cols-3">
          {STEPS.map((title, index) => (
            <div key={title} className="flex items-baseline gap-3">
              <span className={`tech text-[14px] ${index === 0 ? "text-brown" : "text-muted"}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[18px] text-ink">{title}</span>
            </div>
          ))}
        </div>
        <div className="hairline" />
        <p className="mt-6 text-[14px] text-muted">AES-256-CBC · HMAC-SHA256 · PBKDF2 · in your browser</p>
      </section>
    </div>
  );
}
