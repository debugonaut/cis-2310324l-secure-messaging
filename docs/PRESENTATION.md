# ESE Presentation Script & Slide Guide — Secure Messaging System Using AES and HMAC

> **PowerPoint Deck:** [`docs/Secure_Messaging_AES_HMAC.pptx`](./Secure_Messaging_AES_HMAC.pptx) (**11 slides**)  
> **Course:** Cryptography and Information Security Lab (`2310324L`) · MIT Academy of Engineering (Autonomous), Pune  
> **Program:** TY B.Tech Computer Engineering \[Software Engineering\] · AY 2025–26  
> **Integrated Practicals:** Practical 03 (`Symmetric Key Cryptography — AES`) + Practical 08 (`Authentication using HMAC-SHA256`) · **30 Marks ESE**

This deck is built specifically to present **side-by-side with the live browser demo**:
- **Opening (Slides 1–2):** Introduction + What We Are Doing
- **Part 1 — Encryption (Slides 3–7, 5 slides):** Matches Alice's **Sender Pipeline** (`01 Note` → `02 Two keys` → `03 Press` → `04 Seal` → `05 Send`)
- **Part 2 — Decryption (Slides 8–11, 4 slides):** Matches Bob's **Receiver Pipeline** (`01 Parcel` → `02 Bob's seal` + `03 Compare` → `04 Ledger` → `05 Open`)

---

## Opening Slides (Slides 1–2)

### Slide 1 — Introduction
- **Title:** Secure Messaging System Using AES and HMAC
- **Core Idea (Simple words):** Alice and Bob chat privately in two browser tabs over an untrusted server. `AES-256-CBC` (Practical 03) keeps messages secret, and `HMAC-SHA256` (Practical 08) keeps them tamper-proof. Every key, IV, ciphertext block, and tag is computed live by the browser's native Web Crypto API (`crypto.subtle`).
- **Course Outcomes (`2310324L`) Covered:**
  - **`2310324L.CEO.1`** *(Implement cryptography, the CIA triad of information security types)*: **C** (`AES-256-CBC`), **I** (`HMAC-SHA256` MITM tamper rejection), **A** (anti-replay ledger + clean malformed-packet rejection without crash).
  - **`2310324L.CEO.2`** *(Apply encryption mechanisms for secure transmission of data and key management required for encryption)*: Opaque WebSocket relay routing `{ v, seq, IV, ct, mac }` + `PBKDF2-HMAC-SHA256` (`210,000` iterations, 16-byte salt) splitting into non-extractable `K_enc`/`K_mac` + visual key **Fingerprint**.
  - **`2310324L.CEO.3`** *(Build digital signature schemes and message authentication techniques)*: Full `HMAC-SHA256` message authentication (`Encrypt-then-MAC`), constant-time tag verification, and live bit-flip rejection *(note: shared-key MAC authenticates between Alice & Bob cleanly; public-key signatures from Practical 04/07 are noted if asked about non-repudiation)*.
- **Action before presenting:** Open Slide 1 in PowerPoint/Keynote/Google Slides and replace `[Your Name]`, `[Teammate Name]`, and roll numbers in the bottom card.

### Slide 2 — What We Are Doing
- **Three Problems Solved:**
  1. **Eavesdropping (Snooping):** Plain messages can be read on the network → *AES-256-CBC (`Part 1`).*
  2. **MITM Tampering (Editing):** An attacker flips ciphertext bits so the receiver decodes wrong words → *HMAC-SHA256 seal (`Part 2`).*
  3. **Replay Attacks (Re-sending):** An attacker re-sends a previously valid message later → *Sequence counter + Ledger (`Part 2`).*
- **Two-Part Live Demo Rule:** Encryption locks the box (`5 steps`), HMAC seals it, and Bob **never** opens the lock before verifying the seal and checking the sequence ledger (`4 decryption steps`).

---

## Part 1 — Encryption: Alice / Sender Side (Slides 3–7 · 5 Slides)

### Slide 3 (Encryption 1/5) — Step 01: Plaintext Note (`Note`)
- **Simple Explanation:**
  1. Alice types a plain readable message inside her browser tab (`"Hello Bob!"`). Empty input is rejected.
  2. `TextEncoder` turns characters, spaces, and emojis into UTF-8 bytes (`0–255`), because block ciphers operate on bytes rather than text.
  3. Alice's browser assigns an incrementing sequence number (`#001`, `#002`...) to bind each message to its order.
  4. Everything remains local inside the tab — zero bytes touch the wire yet.

### Slide 4 (Encryption 2/5) — Step 02: Stretching Into Two Separate Keys (`Two keys`)
- **Simple Explanation:**
  1. Human passwords are too short and predictable to use directly as AES keys.
  2. Both Alice and Bob mix the shared passphrase (NFKC-normalized) + the room's 16-byte random salt through **`PBKDF2-HMAC-SHA256`** for **210,000 iterations** (`deriveBits` → **512 bits**).
  3. Those 512 bits are split cleanly into two independent 256-bit non-extractable keys:
     - **First 32 bytes (`0..31`) → `K_enc`** (`AES-256-CBC` encryption/decryption only)
     - **Last 32 bytes (`32..63`) → `K_mac`** (`HMAC-SHA256` signing/verifying only)
  4. Both peers see an identical 8-byte `SHA-256(K_enc ‖ K_mac)` **Fingerprint** on the Session Setup screen to verify matching passphrases without exposing keys.

### Slide 5 (Encryption 3/5) — Step 03: Locking Blocks With `AES-256-CBC` (`Press`)
- **Simple Explanation (Practical 03):**
  1. **Fresh 16-byte Random IV:** Generated via `crypto.getRandomValues()` for every message so encrypting the same plaintext twice creates completely different ciphertexts.
  2. **`PKCS#7` Padding:** AES operates strictly in 16-byte blocks. If 10 bytes are entered, 6 bytes of value `0x06` are appended (`16` bytes gets one full 16-byte padding block of `0x10`).
  3. **Cipher Block Chaining (`CBC`):** Block 1 is XOR-ed with the random `IV`, then encrypted with `K_enc` (`14 rounds`). Every later block is XOR-ed with the **previous ciphertext block** before encryption so repeating patterns vanish.

### Slide 6 (Encryption 4/5) — Step 04: Stamping With `HMAC-SHA256` (`Seal`)
- **Simple Explanation (Practical 08):**
  1. AES hides content, but does not prevent someone from flipping ciphertext bytes.
  2. Alice packs all public fields in strict byte order (`macInput`):  
     `VERSION (1 byte) ‖ SEQ (8-byte big-endian uint64) ‖ IV (16 bytes) ‖ CIPHERTEXT (N bytes)`
  3. `HMAC-SHA256(K_mac, macInput)` applies two nested `SHA-256` passes (`ipad = 0x36`, `opad = 0x5C`) to create a 32-byte (256-bit) authentication tag.
  4. Flipping even 1 bit in version, `#seq`, `IV`, or ciphertext changes ~50% (~128 bits) of the tag unpredictably (**Encrypt-then-MAC**).

### Slide 7 (Encryption 5/5) — Step 05: Sending Over the Relay (`Send`)
- **Simple Explanation:**
  1. Alice sends a 5-field JSON envelope over WebSocket (`/ws`): `{ v, seq, ivB64, ctB64, macB64 }`.
  2. The relay server ([`server.ts`](../server.ts)) is deliberately zero-knowledge — it forwards the parcel without ever seeing plain text, passphrases, `K_enc`, or `K_mac`.
  3. **Live MITM Tamper Trigger:** If Alice checked **Tamper next message** in the **Attack** drawer, `flipCiphertextBit()` flips 1 bit (`^= 0x01`) inside `ctB64` right before sending.

---

## Part 2 — Decryption: Bob / Receiver Side (Slides 8–11 · 4 Slides)

### Slide 8 (Decryption 1/4) — Step 01: Receiving the Locked Parcel (`Parcel`)
- **Simple Explanation:**
  1. Bob receives `{ v, seq, ivB64, ctB64, macB64 }` with status **Unverified** (`awaiting`).
  2. **Golden Rule of Encrypt-then-MAC:** **Never run `AES-256-CBC` decryption before verifying the HMAC tag!**
  3. Skipping MAC verification exposes padding-oracle attacks, where probing `PKCS#7` padding errors leaks plaintext bytes.
  4. Both the UI wizard (`ReceiverPipeline`) and `decryptIncoming()` strictly block steps `04 Ledger` and `05 Open` until verification succeeds.

### Slide 9 (Decryption 2/4) — Steps 02–03: Recomputing & Comparing the Seal (`Bob's seal` + `Compare`)
- **Simple Explanation:**
  1. **Recompute (`Bob's seal`):** Bob packs arrived `v`, `seq`, `IV`, and `ciphertext` in the same byte order and computes `HMAC-SHA256` using his own copy of `K_mac`.
  2. **Constant-Time Compare (`Compare`):** Bob checks all 32 bytes using bitwise XOR (`diff |= a[i] ^ b[i]`) without returning early, preventing timing side-channel leaks.
  3. **Match (`0 bits differ`):** Genuine message from Alice with zero bits altered → unlocks Step 04 (`Ledger`).
  4. **Mismatch (MITM bit-flip or wrong password):** Roughly ~128 bits differ → immediate **`Authentication failed` / `Rejected`** — AES decryption never touches the tampered bytes.

### Slide 10 (Decryption 3/4) — Step 04: Checking the Sequence Ledger (`Ledger`)
- **Simple Explanation:**
  1. Even if an attacker replays an **old unmodified message** (`#001`), its HMAC tag still passes `Compare` because nothing was edited!
  2. After MAC verification passes, Bob checks `#seq` against his per-sender ledger (`acceptedRef`) of already-opened sequence numbers.
  3. Fresh `#seq` → unlocks Step 05 (`Open`). Duplicate `#seq` → rejected immediately as **`Replay detected`**.
  4. Because `seq` is signed inside `macInput`, an attacker cannot bump `#001 → #002` without breaking the HMAC back on Slide 9.

### Slide 11 (Decryption 4/4) — Step 05: Opening the Message & Final Summary (`Open`)
- **Simple Explanation:**
  1. Only after HMAC authenticity **and** replay freshness pass does Bob call `AES-256-CBC` decrypt with `K_enc` and the envelope's `IV`.
  2. Inverse AES-256 rounds + XOR undo Cipher Block Chaining across all 16-byte blocks.
  3. `PKCS#7` padding bytes are stripped cleanly and `TextDecoder` reveals the readable plaintext.
  4. `#seq` is saved permanently in Bob's ledger, and an `ack` frame notifies Alice (`Authenticated` / `Delivered`).

---

## Presenter Tip for Side-by-Side Execution
1. Run `npm start` in `CIS_Final_Project` and open the printed `http://127.0.0.1:<port>` URL in two browser tabs (**Alice** & **Bob**) on one side of your screen (or switch Alt+Tab cleanly with PowerPoint).
2. Present **Slides 1–2** first, step through **Slides 3–7** alongside Alice's **Sender Pipeline**, switch speaker to Bob for **Slides 8–11** alongside Bob's **Receiver Pipeline**, then run **Tamper next message** and **Replay last** live!
3. Click the **Reset icon (`↺`)** in the top-right navbar anytime between runs to start completely fresh.
