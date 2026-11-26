import { ArrowRight } from "lucide-react";
import { Badge, Card, Eyebrow } from "../components/ui";

const AES_POINTS = [
  "AES is a symmetric block cipher: the same key encrypts and decrypts.",
  "AES-256 uses a 256-bit key and a 128-bit block.",
  "CBC mode XORs each block with the previous ciphertext block before encrypting it, so identical blocks produce different output.",
  "The IV is a random 128-bit value sent beside the ciphertext. It makes the first block unpredictable and is not secret.",
  "PKCS#7 pads the plaintext to a whole number of blocks; the receiver removes the padding after decryption.",
];

const HMAC_POINTS = [
  "HMAC is a keyed hash. It combines a message with a secret key through SHA-256.",
  "Encryption hides the message but does not prove it arrived unchanged. Ciphertext can still be altered.",
  "HMAC-SHA256 produces a 256-bit tag over the envelope. Any changed bit yields a different tag.",
  "Encryption and authentication use separate derived keys, so one operation cannot weaken the other.",
];

const WORKFLOW = [
  "Alice writes the plaintext",
  "PBKDF2 derives K_enc and K_mac",
  "AES-256-CBC encrypts with a fresh IV",
  "HMAC-SHA256 signs version, sequence, IV and ciphertext",
  "The relay forwards the envelope",
  "Bob recomputes and compares the tag",
  "Bob checks the sequence number",
  "AES decrypts and removes padding",
  "Bob reads the plaintext",
];

export default function HowItWorks() {
  return (
    <div className="shell max-w-4xl pb-24 pt-14 sm:pt-20">
      <Eyebrow>How it works</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-[36px] font-normal leading-[1.12] tracking-[-0.035em] text-ink sm:text-[46px]">
        The journey of one message
      </h1>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">
        AES protects confidentiality. HMAC protects integrity. The receiver verifies before it decrypts.
      </p>

      <section id="aes" className="mt-14">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">AES-256-CBC</h2>
          <Badge tone="brown">Practical 03</Badge>
        </div>
        <ul className="mt-5 space-y-2.5">
          {AES_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[16px] leading-relaxed text-ink-soft">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Flow items={["Plaintext", "AES-256-CBC", "Ciphertext"]} />
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="hmac" className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">HMAC-SHA256</h2>
          <Badge tone="brown">Practical 08</Badge>
        </div>
        <ul className="mt-5 space-y-2.5">
          {HMAC_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[16px] leading-relaxed text-ink-soft">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Flow items={["Envelope + K_mac", "HMAC-SHA256", "32-byte tag"]} />
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="workflow" className="mt-12">
        <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">Complete workflow</h2>
        <ol className="mt-5 grid gap-1.5 sm:grid-cols-2">
          {WORKFLOW.map((step, index) => (
            <li key={step} className="flex items-baseline gap-3 rounded-[9px] bg-sand/40 px-3 py-2">
              <span className="tech text-[13px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-[15px] text-ink-soft">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="architecture" className="mt-12">
        <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">Architecture</h2>
        <div className="mt-5 grid items-stretch gap-2 sm:grid-cols-3">
          <ArchColumn
            title="Alice"
            subtitle="Sender"
            lines={["Plaintext", "AES-CBC encrypt", "HMAC sign", "Sequence number"]}
          />
          <ArchColumn
            title="Relay"
            subtitle="Cannot read"
            lines={["Rooms", "Presence", "Envelope forwarding", "No keys, no plaintext"]}
            muted
          />
          <ArchColumn
            title="Bob"
            subtitle="Receiver"
            lines={["Recompute tag", "Compare", "Replay check", "AES-CBC decrypt"]}
          />
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="about" className="mt-12 scroll-mt-24">
        <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">About the project</h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
          Cryptography &amp; Information Security — integrated submission of Practical 03 (symmetric key cryptography) and
          Practical 08 (message authentication). Every key, ciphertext and tag on this site is produced by the browser&rsquo;s
          Web Crypto API; nothing is simulated.
        </p>
        <div className="mt-5">
          <Card soft className="px-5 py-4">
            <p className="text-[13px] uppercase tracking-[0.12em] text-muted">Scope</p>
            <ul className="mt-2.5 space-y-1.5 text-[15px] leading-relaxed text-ink-soft">
              <li>Two participants per room, ephemeral relay, no persistence.</li>
              <li>The shared passphrase is exchanged out of band; the invitation link never contains it.</li>
              <li>Sequence numbers detect replayed envelopes within a session.</li>
              <li>Keys are non-extractable CryptoKeys and never leave the tab.</li>
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Flow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[11px] border border-line bg-paper px-4 py-3.5">
      {items.map((item, index) => (
        <span key={item} className="flex items-center gap-2">
          <span className="rounded-[7px] border border-line bg-sand/50 px-2.5 py-1 text-[14px] text-ink">{item}</span>
          {index < items.length - 1 ? <ArrowRight size={13} className="text-muted" /> : null}
        </span>
      ))}
    </div>
  );
}

function ArchColumn({
  title,
  subtitle,
  lines,
  muted,
}: {
  title: string;
  subtitle: string;
  lines: string[];
  muted?: boolean;
}) {
  return (
    <div className={muted ? "card-soft px-4 py-4" : "card px-4 py-4"}>
      <div className="flex items-baseline justify-between">
        <p className="text-[16px] font-medium text-ink">{title}</p>
        <span className="text-[12px] uppercase tracking-[0.1em] text-muted">{subtitle}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <li key={line} className="text-[14px] text-ink-soft">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
