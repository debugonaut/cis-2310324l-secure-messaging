# Secure Messaging System Using AES and HMAC

> **CIS Lab — End Semester Practical Examination**  
> MIT Academy of Engineering (Autonomous), Affiliated to Savitribai Phule Pune University  
> TY B.Tech Computer Science & Engineering (Software Engineering) · Batch 2025–26  
> Subject Code: `2310324L` — Cryptography and Information Security Lab

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

## Integrated Practicals

| Practical | Topic | Implementation |
|---|---|---|
| **Practical 03** | Symmetric Key Cryptography | AES-256-CBC with PKCS#7 padding, 128-bit random IV, Web Crypto `encrypt` |
| **Practical 08** | Message Authentication using HMAC | HMAC-SHA256 over `VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT`, Web Crypto `sign` |

The two practicals are **meaningfully integrated** through the **Encrypt-then-MAC (EtM)** construction:
the receiver verifies the HMAC tag *before* decryption, preventing padding-oracle and chosen-ciphertext attacks.

---

## Course Outcomes (COs) Covered

| CO | Outcome | Where Demonstrated |
|---|---|---|
| **CEO.1** | Apply symmetric key cryptography (AES) for confidentiality | AES-256-CBC encryption in `src/lib/crypto.ts`; Sender Pipeline step-by-step walk-through |
| **CEO.2** | Apply HMAC for message integrity and authentication | HMAC-SHA256 in `src/lib/crypto.ts`; Receiver Pipeline MAC verification; tamper-and-reject flow |
| **CEO.3** | Analyse and demonstrate attack detection (MITM, replay) | Tamper mode in Room screen; replay detection via sequence-number ledger; MITM badge on rejected messages |

---

## Features

### 🔐 Real-time Secure Room
- Create or join a named **Room** (6-character code)
- Enter a shared passphrase → keys derived via **PBKDF2-HMAC-SHA256** (210,000 iterations, 128-bit salt) → split into two independent keys via **HKDF-SHA256**: `K_enc` (encryption) and `K_mac` (authentication)
- Domain separation ensures the encryption key and the MAC key are cryptographically independent

### 📤 Sender Pipeline (5 animated steps)
Step-through modal that shows, in real time:
1. **Note** — the plaintext you typed
2. **Two Keys** — PBKDF2 → HKDF derivation diagram (key material, salt, iterations)
3. **Press** — AES-256-CBC encryption with fresh random IV; ciphertext in hex
4. **Seal** — HMAC-SHA256 tag over `VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT`; MAC input in hex
5. **Send** — envelope transmitted to relay; zero plaintext on the wire

### 📥 Receiver Pipeline (5 animated steps)
Step-through modal showing:
1. **Parcel** — raw envelope (IV hex, ciphertext hex, MAC hex)
2. **Bob's Seal** — receiver recomputes HMAC independently
3. **Compare** — constant-time tag comparison; any tampered bit = **Authentication Failed**
4. **Ledger** — sequence-number replay check
5. **Open** — AES-CBC decryption and PKCS#7 unpadding; plaintext revealed

### ⚔️ MITM Tamper Lab
From the Room screen, the sender can enable **Tamper mode** before transmitting — this flips a bit in the ciphertext, letting you watch the receiver reject the envelope in real time with a "Authentication Failed" badge. The message is **never** decrypted after a failed MAC.

### 🔄 Replay Attack Detection
The receiver maintains a sequence-number ledger. Re-sending a previously transmitted envelope triggers "Replay detected" before even checking the MAC.

### 📖 How It Works — Educational Page
A standalone `/how` page that explains:
- AES-256-CBC (what a block cipher is, what CBC mode does, what PKCS#7 padding is)
- HMAC-SHA256 (why encryption alone is insufficient, what a keyed MAC provides)
- The full 9-step end-to-end workflow
- An Encrypt-then-MAC composition diagram

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
| **Relay Server** | Bun + native WebSocket (`Bun.serve`) |
| **Package Manager** | Bun |

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
│   │   ├── crypto.ts            # ★ Cryptographic core (AES-CBC, HMAC, PBKDF2, HKDF)
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
    └── PRESENTATION.md          # Slide-by-slide presentation guide for ESE demo
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

- **Bun** ≥ 1.1 — install from <https://bun.sh>

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install dependencies

```bash
bun install
```

### Run (relay + UI together)

**Terminal 1 — relay server:**
```bash
bun server.ts --port 3001
```

**Terminal 2 — Vite dev server:**
```bash
bun run dev
```

Open <http://localhost:5173> in **two separate browser tabs** (or two devices on the same network).

### Production build

```bash
bun run build         # TypeScript check + Vite bundle → dist/
bun server.ts         # serves dist/ on port 3001
```

---

## Demo Walkthrough (for ESE)

1. **Tab A** → "Create Room" → note the 6-letter room code → "Session Setup" → enter passphrase `cis-demo-2025` → keys derived
2. **Tab B** → "Join Room" → enter room code → "Session Setup" → enter **same** passphrase → keys derived
3. **Tab A (Alice)** → type `Hello from Alice` → Send → watch the **Sender Pipeline** animate all 5 steps
4. **Tab B (Bob)** → accept the pending message → watch the **Receiver Pipeline** animate MAC verification, replay check, and decryption
5. **Enable Tamper** in Tab A → send another message → Bob's pipeline shows **Authentication Failed** → message blocked before decryption
6. **Replay** a past envelope from Alice → Bob's ledger shows **Replay detected**
7. Navigate to `/how` for the full educational explainer

---

## Security Properties

| Property | Mechanism |
|---|---|
| **Confidentiality** | AES-256-CBC, fresh 128-bit random IV per message |
| **Integrity & Authenticity** | HMAC-SHA256, constant-time comparison |
| **EtM ordering** | MAC is verified *before* decryption (prevents padding-oracle) |
| **Key separation** | HKDF domain-separated `K_enc` and `K_mac` |
| **Brute-force resistance** | PBKDF2-SHA256, 210,000 iterations, 128-bit salt |
| **Replay protection** | Monotonically increasing sequence counter per session |
| **Zero server-side secrets** | Relay only routes ciphertexts; passphrase & keys never leave the browser |

---

## Group Details

| Field | Value |
|---|---|
| **Subject** | Cryptography and Information Security Lab (`2310324L`) |
| **Institute** | MIT Academy of Engineering, Pune |
| **Program** | TY B.Tech CSE (Software Engineering) |
| **Practical Integration** | Practical 03 (AES) + Practical 08 (HMAC-SHA256) |
| **ESE Marks** | 30 |
| **Member 1** | *(your name and roll number)* |
| **Member 2** | *(your teammate's name and roll number)* |

---

## License

Academic project — submitted for evaluation under the ESE of `2310324L`.  
All cryptographic primitives used are from the **W3C Web Cryptography API** specification.  
No third-party cryptographic libraries are used.
