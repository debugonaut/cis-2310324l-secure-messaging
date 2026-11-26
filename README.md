# Secure Messaging System Using AES and HMAC

> **CIS Lab — End Semester Practical Examination**  
> MIT Academy of Engineering (An Autonomous Institute Affiliated to Savitribai Phule Pune University)  
> School of Computer Engineering · TY B.Tech Computer Engineering \[Software Engineering\] · AY 2025–26  
> Course Code: `2310324L` — Cryptography and Information Security Lab (`30 Marks` Practical Demo & Presentation)

---

## What is this?

A fully functional **two-party secure messenger** that runs in the browser.

**Alice** and **Bob** join a private room, share a passphrase out-of-band, and then exchange messages that are:

- **Encrypted** with AES-256-CBC (Practical 03) — nobody watching the wire can read the message
- **Authenticated** with HMAC-SHA256 (Practical 08) — nobody can alter the message without being caught
- **Replay-protected** — a captured envelope cannot be re-sent later

Every key, IV, ciphertext block, authentication tag, and timing shown on screen comes from the browser's native **Web Crypto API** (`crypto.subtle`). Nothing is simulated, mocked, or softcoded.

The relay server is deliberately honest: it routes opaque envelopes between peers and never touches a passphrase, key, or plaintext.

---

## Integrated Practicals (from `2310324L` Syllabus)

| Practical | Official Syllabus Topic | Implementation |
|---|---|---|
| **Practical 03** | Implement Symmetric Key Cryptography (`AES, /DES/ RC4 etc.`) | `AES-256-CBC` with `PKCS#7` padding, fresh 128-bit random IV per message, Web Crypto `encrypt`/`decrypt` |
| **Practical 08** | Encode & decode message for Authentication using `HMAC SHA256` | `HMAC-SHA256` over `VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT` via Web Crypto `sign`, constant-time tag verification |

The two practicals are **meaningfully integrated** through the **Encrypt-then-MAC (EtM)** construction:
the receiver verifies the HMAC tag *before* decryption, preventing padding-oracle and chosen-ciphertext attacks.

---

## Course Outcomes (`2310324L`) Covered

| CO | Official Syllabus Statement (`L3`) | Where Demonstrated in Project |
|---|---|---|
| **`2310324L.CEO.1`** | Implement cryptography, the **CIA triad** of information security types | **Confidentiality:** `AES-256-CBC` hides plaintext. **Integrity:** `HMAC-SHA256` catches 1-bit MITM tampering (`Authentication failed`). **Availability / Resilience:** Sequence ledger rejects replay & malformed/oversized packets cleanly before decryption. |
| **`2310324L.CEO.2`** | Apply various encryption mechanisms for **secure transmission of data** and **key management** required for encryption | **Secure Transmission:** WebSocket relay forwards only opaque `{ v, seq, IV, ct, mac }` envelopes. **Key Management:** Shared passphrase + per-room 16-byte random salt stretched via `PBKDF2-HMAC-SHA256` (`210,000` rounds) → split into non-extractable `K_enc` & `K_mac` + visual key **Fingerprint** check (`SessionSetup`). |
| **`2310324L.CEO.3`** | Build digital signature schemes and **message authentication techniques** | **Message Authentication:** Practical 08 `HMAC-SHA256` (`Encrypt-then-MAC`) with constant-time XOR comparison, live step-by-step inspection (`ReceiverPipeline`), MITM bit-flip rejection, and replay protection *(shared-key MAC authentication; non-repudiation is discussed as a future RSA/ECDSA extension)*. |

---

## Features

### 🔐 Real-time Secure Room
- Create or join a named **Room** (6-character invite code + random 128-bit salt)
- Enter a shared passphrase → `PBKDF2-HMAC-SHA256` (210,000 iterations, NFKC-normalized passphrase, 128-bit salt) derives **512 bits**, split into two independent 256-bit non-extractable keys: `K_enc` (first 32 bytes, `AES-CBC`) and `K_mac` (last 32 bytes, `HMAC-SHA256`)
- Each peer displays the same derived key **Fingerprint** (`SHA-256` prefix) for visual verification without exposing key material

### 📤 Sender Pipeline (5 animated steps)
Step-through modal that shows, in real time:
1. **Note** — the plaintext you typed
2. **Two keys** — `PBKDF2` passphrase stretching diagram into `K_enc` and `K_mac` + fingerprint
3. **Press** — `AES-256-CBC` encryption with fresh random 128-bit IV & `PKCS#7` padding; ciphertext blocks in hex
4. **Seal** — `HMAC-SHA256` tag over `VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT`; MAC input and tag in hex
5. **Send** — envelope transmitted to the relay; zero plaintext on the wire

### 📥 Receiver Pipeline (5 animated steps)
Step-through modal enforcing Encrypt-then-MAC ordering:
1. **Parcel** — raw envelope metadata (`IV`, `Ciphertext`, `Seq`, `Tag`)
2. **Bob's seal** — receiver independently recomputes `HMAC-SHA256` with `K_mac`
3. **Compare** — constant-time byte-by-byte XOR tag comparison; any modified bit = **Rejected** (`The two seals are different`) before touching the cipher
4. **Ledger** — sequence-number replay check against previously accepted envelopes
5. **Open** — `AES-256-CBC` decryption and `PKCS#7` unpadding; plaintext revealed

*(Or click **Quick verify** / **Decrypt** directly inside the Room after key establishment.)*

### ⚔️ MITM Tamper Lab
From the Room screen, open **Attack** and check **Tamper next message** before sending — this flips a bit in the transmitted ciphertext (`flipCiphertextBit`), letting you watch the receiver reject the envelope with **Authentication failed** (`Rejected`). AES decryption is strictly blocked whenever MAC verification fails.

### 🔄 Replay Attack Detection
The receiver maintains a per-sender ledger of accepted sequence numbers. Clicking **Replay last** in Alice's **Attack** drawer re-transmits a previously sent envelope through the relay; after authenticating the envelope, Bob's ledger sees the duplicate sequence number and rejects it with **Replay detected** (`This number is already in the ledger`).

### 📖 How It Works — Educational Page
A standalone `/#/how` page (`How it works` / `About the project`) that explains:
- `AES-256-CBC` (block cipher, CBC chaining, non-secret IV, PKCS#7 padding)
- `HMAC-SHA256` (keyed SHA-256 tag, why encryption alone does not prevent tampering, separate derived keys)
- The full 9-step end-to-end workflow
- Alice → Relay → Bob architecture & project scope

---

## Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Animations** | Framer Motion 14 + GSAP 3 |
| **Icons** | Lucide React |
| **Crypto** | Web Crypto API (`crypto.subtle`) — no third-party crypto library |
| **Bundler** | Vite 8 |
| **Relay Server** | Dual-runtime HTTP + WebSocket server (`server.ts` — Node.js ≥ 22.18 or Bun ≥ 1.1) |

---

## Project Structure

```
.
├── server.ts                    # Relay server (HTTP + WebSocket, Bun)
├── src/
│   ├── App.tsx                  # Router shell with Framer Motion page transitions
│   ├── main.tsx                 # React root
│   ├── index.css                # Tailwind CSS v4 + design tokens
│   ├── lib/
│   │   ├── crypto.ts            # ★ Cryptographic core (AES-CBC, HMAC, PBKDF2 512-bit split)
│   │   ├── session.tsx          # Room/session context (WebSocket, message state)
│   │   └── router.ts            # Lightweight hash-based router
│   ├── screens/
│   │   ├── Landing.tsx          # Home page — Create/Join room
│   │   ├── CreateRoom.tsx       # Room creation → relay API
│   │   ├── JoinRoom.tsx         # Room join by code
│   │   ├── SessionSetup.tsx     # Passphrase entry → PBKDF2 key derivation
│   │   ├── Room.tsx             # Live chat (Sender desk / Receiver desk)
│   │   ├── SenderPipeline.tsx   # 5-step animated Sender pipeline modal
│   │   ├── ReceiverPipeline.tsx # 5-step animated Receiver pipeline modal
│   │   └── HowItWorks.tsx       # Educational explainer page
│   └── components/
│       ├── ui.tsx               # Design-system primitives (Button, Card, Badge…)
│       ├── step-animations.tsx  # Per-step SVG/Framer animations
│       ├── visuals.tsx          # Shared diagram visuals
│       └── wizard.tsx           # WizardFrame step-navigator shell
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── docs/
    ├── Secure_Messaging_AES_HMAC.pptx  # 11-slide ESE PowerPoint deck
    └── PRESENTATION.md                 # Companion slide script & viva notes
```

---

## Cryptographic Wire Format

```
Envelope = {
  v:      1 byte   (wire version = 0x01)
  seq:    8 bytes  (big-endian uint64, anti-replay counter)
  ivB64:  base64   (128-bit random IV for AES-CBC)
  ctB64:  base64   (AES-256-CBC ciphertext, PKCS#7 padded)
  macB64: base64   (HMAC-SHA256 tag over v ‖ seq ‖ iv ‖ ct)
}
```

The relay only ever forwards this JSON blob. It never receives the passphrase, `K_enc`, `K_mac`, or any plaintext.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 22.18 (with `npm`) — tested on Node v26.12.0  
  *(Optional: **Bun** ≥ 1.1 also works seamlessly with `bun server.ts`)*

### Install dependencies

```bash
npm install
```

### Run (relay + UI together)

**Terminal 1 — relay server (`127.0.0.1:3001`):**
```bash
npm run dev:relay
```

**Terminal 2 — Vite dev server (`127.0.0.1:5173`):**
```bash
npm run dev
```

Open **<http://127.0.0.1:5173>** in **two separate browser tabs** (each tab maintains its own `sessionStorage` session).

### Production build (single-server mode)

```bash
npm start             # runs tsc --noEmit + vite build → dist/, then serves on http://127.0.0.1:3001
```

---

## Demo Walkthrough (for ESE)

1. **Tab A** → **Create Room** → share the 6-character code or invite link (`#/join/<CODE>`) → wait for Bob → **Continue** → enter passphrase `cis-demo-2025` → **Establish session** → **Enter room**
2. **Tab B** → **Join Room** (or open invite link) → enter the same passphrase `cis-demo-2025` → verify identical key **Fingerprint** → **Enter room**
3. **Tab A (Alice)** → type `Hello from Alice` → **Send** → step through the 5-stage **Sender Pipeline** (`Note` → `Two keys` → `Press` → `Seal` → `Send`)
4. **Tab B (Bob)** → click **Start decryption** → step through the 5-stage **Receiver Pipeline** (`Parcel` → `Bob's seal` → `Compare` → `Ledger` → `Open`)
5. **MITM Tamper Demo:** Open **Attack** in Alice's Room desk → check **Tamper next message** → send a message → watch Bob's Receiver Pipeline halt at **Compare** (`The two seals are different`) / Room show **Authentication failed** (**Rejected**) without decrypting
6. **Replay Demo:** Click **Replay last** in Alice's **Attack** drawer → Bob's MAC passes on **Compare**, then **Ledger** rejects the duplicate sequence number (**Replay detected**) before decryption
7. Open **How it works** (`/#/how`) in the top bar for the architecture and theory overview

---

## Security Properties

| Property | Mechanism |
|---|---|
| **Confidentiality** | AES-256-CBC, fresh 128-bit random IV per message |
| **Integrity & Authenticity** | HMAC-SHA256, constant-time byte-by-byte XOR comparison |
| **EtM ordering** | MAC is verified *before* sequence check and decryption (prevents padding-oracle) |
| **Key separation** | 512-bit PBKDF2 output split into distinct 256-bit `K_enc` and `K_mac` non-extractable keys |
| **Brute-force resistance** | PBKDF2-HMAC-SHA256, 210,000 iterations, 128-bit per-room salt |
| **Replay protection** | Per-sender ledger of accepted sequence numbers (bound inside MAC input) |
| **Zero server-side secrets** | Relay only routes opaque envelopes; passphrase & keys never leave the tab |

---

## Group Details

| Field | Value |
|---|---|
| **Subject** | Cryptography and Information Security Lab (`2310324L`) |
| **Institute** | MIT Academy of Engineering (Autonomous), Pune |
| **Program** | TY B.Tech Computer Engineering \[Software Engineering\] |
| **Practical Integration** | Practical 03 (AES) + Practical 08 (HMAC-SHA256) |
| **ESE Marks** | 30 |
| **Member 1** | *(your name and roll number)* |
| **Member 2** | *(your teammate's name and roll number)* |

---

## License

Academic project — submitted for evaluation under the ESE of `2310324L`.  
All cryptographic primitives used are from the **W3C Web Cryptography API** specification.  
No third-party cryptographic libraries are used.
