import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Fingerprint } from "lucide-react";
import { useState } from "react";
import { useRoute } from "../lib/router";
import { PBKDF2_ITERATIONS, shortHex } from "../lib/crypto";
import { useSession } from "../lib/session";
import { Button, Card, ConnectionDot, Eyebrow, Field, Input, Spinner, TechDetails, TechRow } from "../components/ui";

export default function SessionSetup() {
  const { session, connection, keys, keyState, keyError, establishKeys, peerName, peerOnline } = useSession();
  const { navigate } = useRoute();
  const [passphrase, setPassphrase] = useState("");
  const [visible, setVisible] = useState(false);

  if (!session) {
    return (
      <div className="shell flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Card className="max-w-sm px-6 py-7 text-center">
          <Eyebrow>Session</Eyebrow>
          <p className="mt-3 text-[15px] text-ink-soft">No active room.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button size="sm" onClick={() => navigate("/create")}>
              Create Room
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate("/join")}>
              Join Room
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const ready = keyState === "ready" && keys;

  return (
    <div className="shell flex min-h-[calc(100vh-8rem)] items-start justify-center pb-16 pt-14 sm:items-center sm:pt-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
            <Eyebrow>Session</Eyebrow>
            <span className="tech text-[14px] text-muted">{session.roomId}</span>
          </div>

          <div className="px-6 py-6">
            <h1 className="text-[26px] font-normal tracking-[-0.02em] text-ink">
              {ready ? "Session established" : "Establish session"}
            </h1>

            {!ready ? (
              <>
                <div className="mt-5">
                  <Field label="Shared passphrase">
                    <div className="relative">
                      <Input
                        type={visible ? "text" : "password"}
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        className="pr-11"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void establishKeys(passphrase);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setVisible((value) => !value)}
                        aria-label={visible ? "Hide passphrase" : "Show passphrase"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition hover:bg-sand hover:text-ink"
                      >
                        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                  <p className="mt-2 text-[13px] text-muted">Use the same passphrase on both devices.</p>
                </div>

                {keyError ? <p className="mt-3 text-[14px] text-danger">{keyError}</p> : null}

                <Button className="mt-5" onClick={() => void establishKeys(passphrase)} disabled={keyState === "deriving" || !passphrase.trim()}>
                  {keyState === "deriving" ? <Spinner /> : null}
                  {keyState === "deriving" ? "Deriving…" : "Establish session"}
                </Button>
              </>
            ) : (
              <>
                <div className="mt-5 flex items-center justify-between rounded-[10px] border border-line bg-paper px-4 py-3">
                  <span className="flex items-center gap-2 text-[14px] text-ink-soft">
                    <Fingerprint size={14} className="text-muted" /> Fingerprint
                  </span>
                  <span className="tech text-[14px] tracking-[0.08em] text-ink">{keys.fingerprint}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <ConnectionDot online={connection === "online"} label={connection === "online" ? "Relay connected" : "Reconnecting"} />
                  <span className="text-[14px] text-muted">
                    {peerName} {peerOnline ? "ready" : "waiting"}
                  </span>
                </div>

                <Button className="mt-5" onClick={() => navigate("/room")}>
                  Enter room <ArrowRight size={15} />
                </Button>

                <div className="mt-5">
                  <TechDetails title="Key management parameters" open>
                    <TechRow label="KDF" value="PBKDF2-HMAC-SHA256" />
                    <TechRow label="Room salt" value={`${shortHex(keys.saltB64, 10, 6)} · 16 B`} />
                    <TechRow label="Iterations" value={PBKDF2_ITERATIONS.toLocaleString()} />
                    <TechRow label="Key split" value="512 bits → K_enc (256) ‖ K_mac (256)" />
                    <TechRow label="Storage" value="Non-extractable CryptoKey" />
                  </TechDetails>
                </div>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
