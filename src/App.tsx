import { motion } from "framer-motion";
import { useEffect } from "react";
import { SessionProvider, useSession } from "./lib/session";
import { useRoute } from "./lib/router";
import { Brand } from "./components/ui";
import Landing from "./screens/Landing";
import CreateRoom from "./screens/CreateRoom";
import JoinRoom from "./screens/JoinRoom";
import SessionSetup from "./screens/SessionSetup";
import Room from "./screens/Room";
import HowItWorks from "./screens/HowItWorks";
import SenderPipeline from "./screens/SenderPipeline";
import ReceiverPipeline from "./screens/ReceiverPipeline";

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const { path, parts, navigate } = useRoute();
  const { pipeline } = useSession();
  const inRoom = parts[0] === "room";
  const showChrome = !inRoom;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  const openAbout = () => {
    navigate("/how");
    window.setTimeout(() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" }), 90);
  };

  return (
    <div className="min-h-screen bg-cream">
      {showChrome ? (
        <header className="sticky top-0 z-30 border-b border-line/80 bg-cream/85 backdrop-blur">
          <div className="shell flex h-16 items-center justify-between gap-6">
            <button type="button" onClick={() => navigate("/")} className="shrink-0">
              <Brand />
            </button>

            <nav className="hidden items-center gap-7 text-[15px] text-ink-soft sm:flex">
              <button type="button" onClick={() => navigate("/how")} className="transition hover:text-ink">
                How it works
              </button>
              <button type="button" onClick={openAbout} className="transition hover:text-ink">
                About the project
              </button>
            </nav>

            <p className="text-[12px] uppercase tracking-[0.16em] text-muted">CIS Lab · Practical 03 + 08</p>
          </div>
        </header>
      ) : null}

      <main>
        <motion.div
          key={path}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {parts[0] === "how" ? (
          <HowItWorks />
        ) : parts[0] === "create" ? (
          <CreateRoom />
        ) : parts[0] === "join" ? (
          <JoinRoom roomId={parts[1]?.toUpperCase()} />
        ) : parts[0] === "setup" ? (
          <SessionSetup />
        ) : parts[0] === "room" ? (
          <Room />
          ) : (
            <Landing />
          )}
        </motion.div>
      </main>

      {showChrome ? (
        <footer className="border-t border-line">
          <div className="shell flex flex-wrap items-center justify-between gap-3 py-6 text-[13px] text-muted">
            <span>AES-256-CBC · HMAC-SHA256 · PBKDF2</span>
            <span>CIS Lab · Practical 03 + 08</span>
          </div>
        </footer>
      ) : null}

      {pipeline ? (
        pipeline.mode === "send" ? (
          <SenderPipeline key={pipeline.messageId} messageId={pipeline.messageId} />
        ) : (
          <ReceiverPipeline key={pipeline.messageId} messageId={pipeline.messageId} />
        )
      ) : null}
    </div>
  );
}
