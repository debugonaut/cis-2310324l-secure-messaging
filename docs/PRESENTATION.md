# ESE Presentation Guide — Secure Messaging System Using AES and HMAC

> **Subject:** Cryptography and Information Security Lab (`2310324L`)  
> **Institute:** MIT Academy of Engineering, Pune (Affiliated to SPPU)  
> **Program:** TY B.Tech CSE (Software Engineering)  
> **ESE Marks:** 30 · Integrated: Practical 03 (AES) + Practical 08 (HMAC-SHA256)

This document is structured **slide-by-slide**. Use it to build a PowerPoint/Google Slides deck that runs alongside the live demo.

---

## Slide 1 — Title Slide

**Title:** Secure Messaging System Using AES and HMAC  
**Subtitle:** End Semester Practical Examination — CIS Lab (`2310324L`)  
**Detail lines:**
- MIT Academy of Engineering (Autonomous), Pune
- Integrated Practicals: Practical 03 (AES) + Practical 08 (HMAC-SHA256)
- Member 1: [Name] [Roll No.] | Member 2: [Name] [Roll No.]

**Visual suggestion:** Dark background with subtle cipher-block grid or lock icon in the corner.

---

## Slide 2 — Problem Statement & Motivation

**Heading:** Why Secure Messaging?

**Key points:**
- Messages sent over the internet pass through **untrusted relays** — routers, ISPs, cloud servers
- **Confidentiality problem:** Anyone on the wire can read unencrypted messages
- **Integrity problem:** Anyone can tamper with the message bytes without the sender or receiver knowing
- **Replay problem:** A captured message can be re-sent later to impersonate the sender

**Solution:** Combine AES encryption with HMAC authentication in an **Encrypt-then-MAC** construction

**Visual suggestion:** Simple diagram — Alice → 🌐 (attacker on wire) → Bob — with a crossed-out message text

---

## Slide 3 — Course Outcome Mapping

**Heading:** How This Project Covers All COs

| CO | Statement | Implementation in This Project |
|---|---|---|
| **CEO.1** | Apply symmetric key cryptography (AES) for confidentiality | AES-256-CBC encryption with PKCS#7 padding and 128-bit random IV per message |
| **CEO.2** | Apply HMAC for integrity and authentication | HMAC-SHA256 over VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT; tag verified before decryption |
| **CEO.3** | Analyse and demonstrate security attack detection | MITM tamper mode (bit-flip → rejected); Replay attack via sequence-number ledger |

**Key takeaway:** Both practicals are **meaningfully integrated**, not just placed side-by-side — the EtM construction only works because they both exist together.

---

## Slide 4 — System Architecture Overview

**Heading:** How the System Works

```
[ Alice's Browser ]                    [ Relay Server ]                   [ Bob's Browser ]
                                         (server.ts)
  Passphrase ──→ PBKDF2 (512 bits)                                       Passphrase ──→ PBKDF2 (512 bits)
                     ├─ K_enc (256-bit)                                                     ├─ K_enc (256-bit)
                     └─ K_mac (256-bit)                                                     └─ K_mac (256-bit)

  Plaintext
     ↓ AES-256-CBC (K_enc, fresh IV)
  Ciphertext
     ↓ HMAC-SHA256 (K_mac, VERSION‖SEQ‖IV‖CT)
  Envelope ──────────────────────────────────────────────────────────────→ Envelope
                                                                              ↓ Verify HMAC (K_mac) ← BEFORE decrypt
                                                                              ↓ Check SEQ ledger (replay?)
                                                                              ↓ AES-256-CBC decrypt (K_enc)
                                                                           Plaintext
```

**Key insight:** The relay only ever sees the opaque envelope. Keys never leave the browser.

---

## Slide 5 — Practical 03: AES-256-CBC Deep Dive

**Heading:** AES-256-CBC — Confidentiality (Practical 03)

**What is AES?**
- **A**dvanced **E**ncryption **S**tandard — NIST FIPS 197 (2001)
- Symmetric block cipher: same key encrypts and decrypts
- AES-256 uses a **256-bit key** and a **128-bit block**

**What is CBC mode?**
- **C**ipher **B**lock **C**haining: each plaintext block is XOR-ed with the previous ciphertext block before encryption
- Requires a random **IV** (Initialisation Vector) for the first block
- Identical plaintexts produce **different ciphertexts** (because the IV is fresh each time)

**PKCS#7 Padding:**
- If the last block is 11 bytes, 5 padding bytes of value `0x05` are appended
- Receiver strips padding after decryption using the last byte's value

**What we use:**
- `crypto.subtle.encrypt({ name: "AES-CBC", iv }, encKey, plaintext)`
- Key: `K_enc` — first 256 bits of the 512-bit PBKDF2-HMAC-SHA256 key derivation output
- IV: 128-bit random value from `crypto.getRandomValues()` — different every message

**Visual suggestion:** A 3-block CBC diagram showing XOR with previous ciphertext block before the AES round.

---

## Slide 6 — Practical 08: HMAC-SHA256 Deep Dive

**Heading:** HMAC-SHA256 — Integrity & Authentication (Practical 08)

**What is HMAC?**
- **H**ash-based **M**essage **A**uthentication **C**ode — RFC 2104
- Combines a secret key with the message through two rounds of SHA-256
- Formula: `HMAC(K, M) = SHA256((K⊕opad) ‖ SHA256((K⊕ipad) ‖ M))`
- `ipad = 0x36 × 64`, `opad = 0x5C × 64`

**Why not just encryption?**
- AES-CBC hides the message, but it does **not** detect tampering
- An attacker can flip bits in the ciphertext and change the decrypted plaintext
- HMAC detects *any* change — even a single bit flip produces a completely different tag

**What we MAC:**
```
MAC input = VERSION(1 byte) ‖ SEQ(8 bytes, big-endian) ‖ IV(16 bytes) ‖ CIPHERTEXT(n bytes)
MAC tag   = HMAC-SHA256(K_mac, MAC input)   →   32-byte tag
```

**Why include VERSION and SEQ?**
- VERSION prevents an attacker from downgrading the protocol
- SEQ prevents replay attacks by binding the tag to this specific message number

**What we use:**
- `crypto.subtle.sign("HMAC", macKey, macInput)` with SHA-256

**Visual suggestion:** ipad/opad diagram or the two-pass SHA-256 compression structure.

---

## Slide 7 — Key Derivation (PBKDF2-HMAC-SHA256)

**Heading:** From Passphrase to Two Independent Keys

**Step 1 — Passphrase Normalization & PBKDF2** (Password-Based Key Derivation Function 2):
- Input: NFKC-normalized passphrase + 128-bit random salt (generated per room by the relay)
- Hash: `SHA-256`, **210,000 iterations** (OWASP recommended work factor)
- Output: **512 bits** of stretched pseudo-random key material (`crypto.subtle.deriveBits`)
- Purpose: makes offline brute-force / dictionary guessing computationally expensive

**Step 2 — Splitting 512 bits into two independent 256-bit keys**:
- First 32 bytes (256 bits) → `K_enc` (imported non-extractable for `AES-CBC`)
- Last 32 bytes (256 bits) → `K_mac` (imported non-extractable for `HMAC-SHA256`)
- Separating keys ensures encryption and authentication never share raw key bytes

**Fingerprint verification:**
- UI computes `SHA-256(K_enc ‖ K_mac)` (first 8 bytes formatted as uppercase hex blocks)
- Both peers can visually compare fingerprints before chatting — if passphrases differ, fingerprints differ too!

---

## Slide 8 — Encrypt-then-MAC Composition

**Heading:** Why EtM — The Secure Ordering

**Three possible orderings:**
| Scheme | Description | Vulnerable To |
|---|---|---|
| Encrypt-and-MAC | Encrypt plaintext, MAC plaintext separately | Leaks plaintext structure via MAC |
| MAC-then-Encrypt | MAC plaintext, then encrypt both | Padding-oracle attacks on MAC |
| **Encrypt-then-MAC** ✅ | Encrypt plaintext, MAC the ciphertext | ✅ Secure — TLS 1.3 uses this |

**Our construction:**
```
1. ct = AES-256-CBC(K_enc, IV, plaintext)
2. tag = HMAC-SHA256(K_mac, VERSION ‖ SEQ ‖ IV ‖ ct)
3. send: { v, seq, IV, ct, tag }

Receiver:
4. tag' = HMAC-SHA256(K_mac, VERSION ‖ SEQ ‖ IV ‖ ct)
5. if tag ≠ tag' → REJECT (never reach step 6)
6. check SEQ not already in accepted ledger → REJECT if duplicate
7. plaintext = AES-256-CBC-decrypt(K_enc, IV, ct)
```

**Key property:** The receiver **never decrypts** unauthenticated data.

---

## Slide 9 — Live Demo Walkthrough

**Heading:** Demo — Room, Messages, Inspect

**Demo script (do this live during ESE):**

| Step | Action | What to point out |
|---|---|---|
| 1 | Open two tabs; Alice creates room | 6-character room code, salt stored on relay |
| 2 | Bob joins same room | No passphrase yet — session locked |
| 3 | Both enter passphrase "cis-demo-2025" | PBKDF2 spinner, then "Keys ready" |
| 4 | Alice types and sends a message | Sender Pipeline opens automatically |
| 5 | Walk through Sender Pipeline steps 1→5 | Plaintext → Key derivation → AES → HMAC → Wire |
| 6 | Bob accepts the message | Receiver Pipeline opens |
| 7 | Walk through Receiver Pipeline steps 1→5 | Envelope → Recompute MAC → Compare → SEQ check → Decrypt |
| 8 | Show hex values | IV hex, ciphertext hex, MAC input hex, tag hex |

---

## Slide 10 — MITM Tamper Attack Demo

**Heading:** Demo — Man-in-the-Middle Tamper

**Demo script:**
1. Alice opens the **Attack** drawer in the Room screen and ticks **Tamper next message**
2. Alice types and sends a message
3. Step through Sender Pipeline — `transmit()` flips 1 bit in the middle of the ciphertext (`flipCiphertextBit`)
4. Bob opens **Start decryption** → Steps 1–2 (`Bob's seal` → `Compare`) → **tag mismatch** (`The two seals are different`) → cannot advance past Step 2
5. Back in the room, message is marked **Rejected** (`Authentication failed`) — AES decryption never ran

**What to explain:**
- Even a passive/active relay can flip ciphertext bits because it sees `{ ivB64, ctB64 }`
- Because we compute `HMAC-SHA256` over `VERSION ‖ SEQ ‖ IV ‖ CIPHERTEXT`, modifying *any* field alters the recomputed tag cleanly
- Encrypt-then-MAC rejects at the MAC gate **before** touching AES decryption or PKCS#7 padding (preventing padding-oracle attacks)

**Show:** The `Details` drawer on Step 2 — `Received` vs `Recomputed` hex and differing bit count (~50% of 256 bits due to SHA-256 avalanche effect)

---

## Slide 11 — Replay Attack Demo

**Heading:** Demo — Replay Attack Detection

**Demo script:**
1. Alice sends a normal message → Bob accepts and decrypts it (`#001`)
2. Alice opens **Attack** and clicks **Replay last**
3. The exact previous envelope (`seq = 1`, intact ciphertext & intact MAC) is re-sent through the relay
4. Bob opens **Start decryption** → Step 2 **Compare** passes (because the envelope is genuinely from Alice and unmodified!)
5. At Step 3 **Ledger**, Bob checks `accepted.includes(1)` → **duplicate found** (`This number is already in the ledger`) → Step 4 **Open** is blocked and message shows **Replay detected** (`Rejected`)

**What to explain:**
- Even an authentic, unmodified envelope with a valid HMAC must be blocked if an attacker captures and re-sends it
- Encrypt-then-MAC verifies authenticity **first** (so attackers cannot forge fake sequence numbers to pollute state), and the sequence ledger catches genuine replayed envelopes second
- Sequence numbers are bound inside `macInput`, so an attacker cannot bump `seq` to bypass the ledger without invalidating the HMAC tag

---

## Slide 12 — How It Works Page

**Heading:** Educational Reference — `/#/how`

The app includes a dedicated `/how` page for the examiner:
- **AES-256-CBC** section — bullet points + simple flow diagram
- **HMAC-SHA256** section — bullet points + flow diagram  
- **9-step end-to-end workflow** — from Alice writing to Bob reading
- **EtM composition diagram** — visual of the sender/receiver pipeline

Point the examiner to this page and walk through it briefly before the live demo.

---

## Slide 13 — Implementation Highlights

**Heading:** Why This Implementation is Correct

| Point | Evidence |
|---|---|
| Uses real Web Crypto API | `crypto.subtle.encrypt`, `crypto.subtle.sign` — no polyfill or toy implementation |
| AES-256 key size | First 32 bytes (256 bits) of 512-bit PBKDF2 output imported as AES-CBC `CryptoKey` |
| PKCS#7 padding handled by browser | Web Crypto applies and strips padding automatically |
| Constant-time tag comparison | Manual byte-by-byte XOR accumulator — prevents timing attacks |
| Fresh IV per message | `crypto.getRandomValues(new Uint8Array(16))` before every `encrypt` |
| PBKDF2 iterations | 210,000 iterations with 128-bit per-room random salt |
| No plaintext on relay | Relay only receives `{ v, seq, ivB64, ctB64, macB64 }` |

---

## Slide 14 — Conclusion

**Heading:** Secure Messaging — Putting It All Together

**What we built:**
- A production-grade secure messaging application integrating AES (Practical 03) and HMAC (Practical 08) through the **Encrypt-then-MAC** pattern
- Step-by-step animated pipelines that visually explain every cryptographic operation
- Live attack simulations (MITM tamper, replay) demonstrating how both defences work

**Security properties achieved:**
- ✅ Confidentiality (AES-256-CBC)
- ✅ Integrity & Authenticity (HMAC-SHA256)
- ✅ Replay Protection (sequence counter in MAC input + per-sender ledger)
- ✅ Brute-force Resistance (PBKDF2 × 210,000)
- ✅ Padding-oracle Prevention (EtM ordering)
- ✅ No server-side secrets (zero-knowledge relay)

**Course Outcomes:** CEO.1 ✅  CEO.2 ✅  CEO.3 ✅

---

## Appendix A — Key File Reference

| File | What it does |
|---|---|
| `src/lib/crypto.ts` | All crypto: AES-256-CBC, HMAC-SHA256, PBKDF2 512-bit split, constant-time compare, bit-flip helpers |
| `src/lib/session.tsx` | Room/session state, WebSocket, message lifecycle, tamper/replay controls |
| `src/screens/SenderPipeline.tsx` | 5-step animated sender walkthrough |
| `src/screens/ReceiverPipeline.tsx` | 5-step animated receiver walkthrough (verify → replay → decrypt) |
| `src/screens/HowItWorks.tsx` | Educational explainer page |
| `src/screens/Room.tsx` | Main chat UI with Attack drawer (`Tamper next message`, `Replay last`) |
| `src/components/step-animations.tsx` | Per-step SVG + GSAP animations |
| `server.ts` | Relay: HTTP room API + WebSocket message routing (Node.js & Bun) |

## Appendix B — Glossary

| Term | Definition |
|---|---|
| **AES** | Advanced Encryption Standard — symmetric block cipher (NIST FIPS 197) |
| **CBC** | Cipher Block Chaining — AES mode that XORs each block with the previous ciphertext |
| **PKCS#7** | Padding scheme: append N bytes of value N to reach a block boundary |
| **IV** | Initialisation Vector — random 128-bit value that starts the CBC chain |
| **HMAC** | Hash-based Message Authentication Code — keyed hash using SHA-256 (RFC 2104) |
| **EtM** | Encrypt-then-MAC — MAC the ciphertext, not the plaintext; verify before decryption |
| **PBKDF2** | Password-Based Key Derivation Function 2 — slows brute-force with 210,000 SHA-256 iterations |
| **K_enc** | Encryption key — first 32 bytes (256 bits) of PBKDF2 output, non-extractable AES-CBC key |
| **K_mac** | Authentication key — last 32 bytes (256 bits) of PBKDF2 output, non-extractable HMAC key |
| **SEQ** | Sequence number — monotonically increasing counter included in MAC input |
| **Relay** | The server — only routes ciphertexts; never sees passphrase or plaintext |
| **Constant-time compare** | Bit-by-bit XOR accumulator that prevents timing attacks on MAC comparison |
