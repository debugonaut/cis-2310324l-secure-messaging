import { ArrowRight } from "lucide-react";
import { Badge, Card, Eyebrow } from "../components/ui";

const CIA_TRIAD = [
  {
    pillar: "Confidentiality",
    threat: "Eavesdropping & traffic inspection",
    control: "AES-256-CBC with fresh random 128-bit IV & PKCS#7 padding (Practical 03)",
  },
  {
    pillar: "Integrity & Authenticity",
    threat: "Man-in-the-Middle bit-flip tampering",
    control: "HMAC-SHA256 over version ‖ seq ‖ IV ‖ ciphertext, checked before decryption (Practical 08)",
  },
  {
    pillar: "Availability & Freshness",
    threat: "Replay attacks & malformed frames",
    control: "Monotonic sequence counter verified against per-sender ledger + strict envelope validation",
  },
];

const AES_POINTS = [
  "AES is a symmetric block cipher (NIST FIPS 197): the same 256-bit key (K_enc) locks and unlocks 128-bit data blocks across 14 transformation rounds (SubBytes, ShiftRows, MixColumns, AddRoundKey).",
  "CBC mode XORs each plaintext block with the previous ciphertext block before encryption, hiding identical words across blocks.",
  "The IV is a fresh random 128-bit value per message sent alongside the ciphertext; it prevents identical ciphertexts for repeated messages and is non-secret.",
  "PKCS#7 appends deterministic pad bytes up to a 16-byte boundary before encryption; Web Crypto removes them after verified decryption.",
];

const HMAC_POINTS = [
  "HMAC-SHA256 (RFC 2104) combines K_mac with the message in two nested SHA-256 passes using inner/outer pads (ipad 0x36, opad 0x5C) to emit a 256-bit authentication tag.",
  "Encryption hides content but does not prove nobody flipped ciphertext bits in transit — HMAC guarantees data integrity and shared-key authenticity.",
  "Our Encrypt-then-MAC seal covers Version (1 B) ‖ Seq (8 B) ‖ IV (16 B) ‖ Ciphertext, and is compared byte-by-byte in constant time prior to AES decryption.",
  "Key Management (CO2): PBKDF2-HMAC-SHA256 stretches the passphrase + 16-byte room salt across 210,000 rounds into 512 bits, splitting non-extractable K_enc and K_mac.",
];

const WORKFLOW = [
  "Alice writes the plaintext (#seq attached)",
  "PBKDF2 derives separate K_enc and K_mac",
  "AES-256-CBC encrypts with a fresh random IV",
  "HMAC-SHA256 signs version, seq, IV and ciphertext",
  "Zero-knowledge relay forwards the envelope",
  "Bob independently recomputes HMAC-SHA256",
  "Constant-time tag compare rejects MITM tampering",
  "Sequence ledger blocks replayed envelopes",
  "AES-256-CBC decrypts & strips PKCS#7 padding",
];

const RUBRIC_ROWS = [
  {
    criterion: "1. Conceptual Understanding of CIS",
    marksCo: "10 Marks · CO1",
    evidence: "CIA triad, threat model (snooping, MITM, replay), EtM rationale & working principles of AES-256-CBC and HMAC-SHA256.",
  },
  {
    criterion: "2. Algorithm Implementation & Key Mgmt",
    marksCo: "8 Marks · CO2",
    evidence: "Web Crypto AES-256-CBC + 16B room salt + PBKDF2 (210k) splitting non-extractable K_enc & K_mac + Fingerprint check.",
  },
  {
    criterion: "3. Digital Signature & Msg Authentication",
    marksCo: "6 Marks · CO3",
    evidence: "HMAC-SHA256 Encrypt-then-MAC, constantTimeEqual verify gate prior to decryption, live bit-flip rejection & replay ledger.",
  },
  {
    criterion: "4. Integration, Demo, PPT & Q&A",
    marksCo: "6 Marks · CO1–CO3",
    evidence: "Tight Practical 03 + 08 EtM coupling over live WebSocket relay, 5-step encrypted/decrypted pipelines, tamper & replay labs.",
  },
];

export default function HowItWorks() {
  return (
    <div className="shell max-w-4xl pb-24 pt-14 sm:pt-20">
      <Eyebrow>How it works · CIS Lab 2310324L</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-[36px] font-normal leading-[1.12] tracking-[-0.035em] text-ink sm:text-[46px]">
        The journey of one message
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
        AES protects confidentiality. HMAC guarantees integrity and authenticity. Encrypt-then-MAC enforces verification
        and replay checks before decryption ever runs.
      </p>

      <section id="cia" className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">CIA Triad &amp; Threat Model</h2>
          <Badge tone="brown">CO1</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {CIA_TRIAD.map((item) => (
            <Card key={item.pillar} soft className="px-4 py-4">
              <p className="text-[15px] font-medium text-ink">{item.pillar}</p>
              <p className="mt-1.5 text-[13px] text-brown">Threat: {item.threat}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{item.control}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="aes" className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">AES-256-CBC</h2>
          <Badge tone="brown">Practical 03</Badge>
        </div>
        <ul className="mt-5 space-y-2.5">
          {AES_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[16px] leading-relaxed text-ink-soft">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Flow items={["Plaintext + PKCS#7", "CBC XOR (IV)", "AES-256 (K_enc)", "Ciphertext"]} />
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="hmac" className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">HMAC-SHA256 &amp; Key Management</h2>
          <Badge tone="brown">Practical 08</Badge>
        </div>
        <ul className="mt-5 space-y-2.5">
          {HMAC_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[16px] leading-relaxed text-ink-soft">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Flow items={["v ‖ seq ‖ IV ‖ ciphertext", "HMAC-SHA256 (K_mac)", "32-byte tag"]} />
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
            lines={["Plaintext (#seq)", "PBKDF2 → K_enc, K_mac", "AES-256-CBC encrypt", "HMAC-SHA256 seal"]}
          />
          <ArchColumn
            title="Relay"
            subtitle="Zero-knowledge"
            lines={["Rooms & 16B salt", "WebSocket presence", "Opaque envelope route", "No keys, no plaintext"]}
            muted
          />
          <ArchColumn
            title="Bob"
            subtitle="Receiver"
            lines={["Recompute HMAC tag", "Constant-time compare", "Sequence replay check", "AES-256-CBC decrypt"]}
          />
        </div>
      </section>

      <div className="mt-12 hairline" />

      <section id="about" className="mt-12 scroll-mt-24">
        <h2 className="text-[24px] font-normal tracking-[-0.02em] text-ink">About &amp; ESE Rubrics (30 Marks)</h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
          Integrated ESE project for 2310324L (Cryptography and Information Security Lab) combining Practical 03
          (Symmetric Key Cryptography — AES) and Practical 08 (Message Authentication using HMAC-SHA256). Every key,
          ciphertext, and tag runs via the browser Web Crypto API.
        </p>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="rubric-table-caption"
          className="rubric-table-wrap mt-6 rounded-[12px] border border-line bg-paper"
        >
          <table className="rubric-table text-left text-[14px]">
            <caption id="rubric-table-caption" className="sr-only">
              ESE Integrated Project Rubrics (30 Marks) and Course Outcome Mapping
            </caption>
            <thead>
              <tr className="border-b border-line bg-sand text-[12px] uppercase tracking-[0.12em] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Criterion</th>
                <th scope="col" className="px-4 py-3 font-medium">Marks &amp; CO</th>
                <th scope="col" className="px-4 py-3 font-medium">Where Demonstrated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {RUBRIC_ROWS.map((row) => (
                <tr key={row.criterion}>
                  <th scope="row" className="px-4 py-3 font-medium text-ink align-top">
                    {row.criterion}
                  </th>
                  <td className="px-4 py-3 text-brown font-medium align-top whitespace-nowrap">
                    {row.marksCo}
                  </td>
                  <td className="px-4 py-3 leading-relaxed text-ink-soft align-top">
                    {row.evidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          {index < items.length - 1 ? <ArrowRight size={13} className="text-muted" aria-hidden="true" /> : null}
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
