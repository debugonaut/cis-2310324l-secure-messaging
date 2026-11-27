# In-Depth Slide-by-Slide Guide — Practical 08: HMAC-SHA256 Authentication

> **Target Deck:** [`docs/Practical_08_HMAC_SHA256.pptx`](./Practical_08_HMAC_SHA256.pptx) (**55 Slides** on `main` · also cross-indexed to the **20-Slide edition** `[Old S#]`)  
> **Video Visual Source:** JayPMedia — *HMAC & Message Authentication Codes (MACs) - Why Hashing alone is NOT ENOUGH for data integrity* (`youtube.com/watch?v=vdzB5Rraeb4`)  
> **Course & Practical:** Cryptography and Information Security Lab (`2310324L`) · Practical 08 (*Authentication using HMAC-SHA256*) · MIT Academy of Engineering  
> **Course Outcomes Covered:** `CO1 (2310324L.CEO.1)` · `CO2 (2310324L.CEO.2)` · `CO3 (2310324L.CEO.3)`

---

## Quick Index: Mapping the Old 20-Slide Deck → Current 55-Slide Deck

| Old 20-Slide Deck | Topic Covered | New 55-Slide Deck | Timestamp |
|---|---|---|---|
| **S1** | Cover (`PRACTICAL 08 · MESSAGE AUTHENTICATION`) | **S1** | Cover |
| **S2** | `1. Two Parties Sharing a Secret Key` | **S3** | `00:16` |
| **S3** | `2. The Problem: Bit-Flipping Attack on Ciphertext` | **S10** | `00:48` |
| **S4** | `3. Plain Hashing Basics (SHA-256 Digest)` | **S16** | `01:20` |
| **S5** | `4. Receiver Checking Plain Hash Match` | **S22** | `01:45` |
| **S6** | `5. The Flaw: Attacker Alters Message AND Re-Hashes It` | **S24–S25** | `02:01`–`02:07` |
| **S7** | `6. Solution: What HMAC Stands For` | **S26–S27** | `02:15`–`02:18` |
| **S8** | `7. HMAC in Action: Combine Encrypted Data + Secret Key` | **S30** | `02:43` |
| **S9** | `8. Sending Encrypted Message + MAC Tag Together` | **S32** | `02:51` |
| **S10** | `9. Tamper Caught: Attacker Lacks the Secret Key` | **S34** | `03:07` |
| **S11** | `10. What MAC Guarantees: Authenticity & Integrity` | **S38** | `03:35` |
| **S12** | `11. HMAC Among Common MAC Algorithms` | **S39** | `03:44` |
| **S13** | `12. Real-World Usage: TLS 1.3 Handshake` | **S40** | `04:00` |
| **S14** | `13. HMAC Is Flexible (SHA-256, SHA-3, etc.)` | **S41** | `04:13` |
| **S15** | `14. HMAC Is Standardized in RFC 2104 (Feb 1997)` | **S42** | `04:20` |
| **S16** | `15. Security Property: Pseudorandom & Unpredictable Output` | **S46** | `04:52` |
| **S17** | `16. Inside RFC 2104: ipad & opad XOR Formula` | **S48–S49** | `05:02`–`05:07` |
| **S18** | `17. Security Benefit: Resistant to Birthday Attacks` | **S50** | `05:16` |
| **S19** | `18. Why Modify Key Internally? (Washing-Machine Analogy)` | **S54** | `05:49` |
| **S20** | `THANK YOU` + Our Live App (`Encrypt-then-MAC` + Replay) | **S55** | Closer |

---

## Slide-by-Slide Deep Explanation

### Slide 1 `[Old S1]` — Title Slide (`PRACTICAL 08 · MESSAGE AUTHENTICATION`)
- **What is on the slide:** Split cover card showing Practical 08 metadata on the left (`CIS Lab 2310324L`, CO1/CO2/CO3 mapping) and `HMAC-SHA256 Message Authentication` on the dark charcoal right panel.
- **In-depth explanation:**
  - While **Practical 03 (AES)** addresses **Confidentiality** (stopping passive readers from understanding plaintext), **Practical 08 (HMAC-SHA256)** solves **Integrity** (did anyone change a single bit?) and **Authenticity** (did the message truly come from someone holding our shared secret key?).
  - In our real app (`src/lib/crypto.ts`), `PBKDF2-HMAC-SHA256` derives a dedicated 256-bit key `K_mac` completely separate from the AES encryption key `K_enc`.
- **What to say aloud:** *"Practical 08 focuses on Message Authentication using HMAC-SHA256. While AES hides what we write, HMAC proves nobody tampered with the packet and proves who sent it."*

---

### Chapter 1 — Public Internet & Limits of Confidentiality Only (`Slides 2–6`)

#### Slide 2 (`00:06`) — `01. Public Network Scenario (JayP & Joe)`
- **Visual:** JayP (sender) on the left and Joe (receiver) on the right preparing to communicate across a public network.
- **In-depth explanation:** Over the public internet (Wi-Fi routers, ISPs, relays—just like our `server.ts` WebSocket relay), packets travel across untrusted infrastructure where intermediaries can observe, store, modify, or re-inject traffic. Security protocols must assume an **untrusted channel**.

#### Slide 3 `[Old S2]` (`00:16`) — `02. Shared Symmetric Key Setup`
- **Visual:** Both JayP and Joe hold identical yellow keys connected across the channel.
- **In-depth explanation:** Before exchanging encrypted messages, both parties establish a shared symmetric key (`K_enc` in our app, derived identically in Alice's and Bob's browsers using the shared room passphrase + 16-byte room salt).

#### Slide 4 (`00:23`) — `03. Confidentiality Stops Passive Eavesdropping`
- **Visual:** Encrypted document in transit while big eyes watch overhead.
- **In-depth explanation:** When JayP encrypts with a strong symmetric cipher like `AES-256-CBC`, **Confidentiality** holds: passive eavesdroppers see only high-entropy ciphertext bytes with zero correlation to the original text.
- **Key exam distinction:** *Confidentiality ≠ Integrity.* Encryption keeps secrets hidden from **passive** observers, NOT safe from **active** modification.

#### Slide 5 (`00:31`) — `04. Limitation: Active Attacker Can Intercept Data`
- **Visual:** Chatty (the attacker) stands next to the encrypted document in the middle of the channel.
- **In-depth explanation:** An active Man-in-the-Middle (MITM) does not need the secret key to grab packets off the wire, pause them, drop them, or alter bits before forwarding them toward Joe.

#### Slide 6 (`00:35`) — `05. Blind Tampering Possible Despite Encryption`
- **Visual:** Chatty hovering over the active channel ready to attack ciphertext.
- **In-depth explanation:** In unauthenticated encryption modes (like raw `AES-CBC` without a MAC), ciphertext is **malleable**: flipping bits in ciphertext block $C_{i-1}$ predictably XOR-flips the exact corresponding bits in decrypted plaintext block $P_i$ (and scrambles $P_{i-1}$), allowing targeted manipulation without decrypting anything!

---

### Chapter 2 — Bit-Flipping Attack Example (`Slides 7–14`)

#### Slide 7 (`00:42`) — `06. Bit-Flipping Attack Scenario ($100 Bank Transfer)`
- **Visual:** JayP holds a `$100` transfer instruction pointed toward Joe's Bank (`$`).
- **In-depth explanation:** Sets up a concrete high-stakes banking payload where changing just a couple digits (`$100` → `$1000`) changes financial outcomes drastically.

#### Slide 8 (`00:44`) — `07. Encrypted $100 Message Enters Transit`
- **Visual:** Yellow padlock + key wrap the `$100` document leaving JayP.
- **In-depth explanation:** Even though TLS/AES encrypts `$100`, suppose an unauthenticated cipher is used—nobody can read the amount in transit, yet the bytes remain modifiable on the wire.

#### Slide 9 (`00:46`) — `08. Chatty Blindly Flips Ciphertext Bits (010101)`
- **Visual:** Chatty thinking of binary `010101 / 01010` while touching the packet.
- **In-depth explanation:** Chatty flips raw bits inside the ciphertext. In stream ciphers (`CTR`, `OFB`) or `CBC`'s IV/previous block, flipping bit $b$ in ciphertext flips the **exact same bit** $b$ after decryption (`ASCII '1'` vs `'9'` or spacing padding into `'0'`). That mirrors clicking **Tamper next message** (`flipCiphertextBit()`) inside our app!

#### Slide 10 `[Old S3]` (`00:48`) — `09. Tampered Ciphertext Forwarded to the Bank`
- **Visual:** Chatty relays the altered ciphertext packet along the arrow to the bank.
- **In-depth explanation:** From the bank's perspective, the TCP/WebSocket frame still arrives with valid structure and valid AES padding, so AES decryption alone has zero clue tampering occurred.

#### Slide 11 (`00:58`) — `10. Bank Decrypts $1000 Instead of $100!`
- **Visual:** Shocked JayP sweating on the left while a green `$1000` bill arrives at the bank.
- **In-depth explanation:** **Crucial viva lesson:** AES `decrypt()` is purely mathematical—it converts whatever bytes you pass into output bytes. If ciphertext was tampered, AES silently outputs corrupted/forged plaintext (`$1000` instead of `$100`) without raising an integrity error (unless bad padding happens by chance, which still leaves a **Padding Oracle** risk!).

#### Slide 12 (`01:03`) — `11. Core Security Rule: Data Integrity Is a Must`
- **Visual:** Pointing finger beside `"Data integrity is a must."`
- **In-depth explanation:** Concludes CO1 motivation cleanly: every secure channel needs **both** Confidentiality (`AES`) and Integrity/Authentication (`HMAC`).

#### Slide 13 (`01:07`) — `12. How Can Receiver Verify Data Integrity?`
- **Visual:** JayP on left, Joe holding the document asking `"How can Joe make sure message is not altered?"`
- **In-depth explanation:** Transitions from the problem to designing a verification mechanism Joe can execute independently upon receiving a packet.

#### Slide 14 (`01:09`) — `13. Question: Detecting Unseen Modification in Transit`
- **Visual:** Joe imagining Chatty silently writing changes onto the document mid-flight.
- **In-depth explanation:** Frames the requirement: we need a mathematical fingerprint tied tightly to every single bit of the transmitted payload.

---

### Chapter 3 — Plain Hashing (`Slides 15–23`)

#### Slide 15 (`01:15`) — `14. Standard Integrity Attempt: Plain Hashing (SHA-256)`
- **Visual:** Document funneling into a red `SHA256` icon.
- **In-depth explanation:** A cryptographic hash function $H(m)$ is deterministic (same input → identical digest), one-way (preimage-resistant), and fixed-width (`SHA-256` always outputs `256 bits = 32 bytes = 64 hex characters` regardless of message size).

#### Slide 16 `[Old S4]` (`01:20`) — `15. SHA-256 Produces Fixed-Size Digest (ae9f013a)`
- **Visual:** Document → red `SHA256` funnel → `ae9f013a`.
- **In-depth explanation:** Internally, SHA-256 pads the data to 512-bit (`64-byte`) blocks and executes 64 compression rounds using bitwise rotations, additions mod $2^{32}$, and round constants to output `ae9f013a...` (compact visual placeholder for a 256-bit hash).

#### Slide 17 (`01:24`) — `16. Terminology: Hash Value / Digest / Checksum`
- **Visual:** Callouts naming `ae9f013a` as `Digest` / `Checksum`.
- **In-depth explanation:** In CIS exams, *"hash value"*, *"message digest"*, and *"cryptographic checksum"* refer to this same fixed-size fingerprint produced by SHA-256. *(Whereas plain CRC checksums only detect accidental noise, cryptographic hashes resist deliberate collisions.)*

#### Slide 18 (`01:29`) — `17. Sending Message Alongside Digest (ae9f013a)`
- **Visual:** Document stamped with `(ae9f013a)` sent toward Joe.
- **In-depth explanation:** Plain hashes are unkeyed (`SHA-256` has no secret key), so JayP sends the message together with its public digest over the channel.

#### Slide 19 (`01:30`) — `18. Hashing Property: Original Bits → ae9f013a`
- **Visual:** Input bit sequence `101001 / 101011` producing `ae9f013a`.
- **In-depth explanation:** Demonstrates **determinism**: repeating the exact same input bits always yields `ae9f013a`.

#### Slide 20 (`01:32`) — `19. Avalanche Effect: 1 Flipped Bit → Completely New Hash`
- **Visual:** Top input `101001 / 101011 → ae9f013a` vs bottom `101001 / 101010` (last `0` in red) → red document → `430bfe06`.
- **In-depth explanation:** **Avalanche Effect** (essential property for CO3!): flipping 1 input bit changes ~50% of the output bits completely unpredictably (`ae9f013a` → `430bfe06`). Attackers cannot tweak output hashes incrementally to match a forged message.

#### Slide 21 (`01:37`) — `20. Receiver Step: Joe Receives Document & Hash`
- **Visual:** Joe scratching his chin beside received document + `(ae9f013a)`.
- **In-depth explanation:** To verify, Joe never trusts the attached hash alone—he independently re-computes `SHA-256` on the received payload bytes.

#### Slide 22 `[Old S5]` (`01:45`) — `21. Receiver Re-Hashes & Compares Digests`
- **Visual:** Joe passes the received doc through `SHA256` and compares with received `(ae9f013a)`.
- **In-depth explanation:** Compares `computedHash` byte-for-byte with `receivedHash`. Works well for detecting accidental network glitches (like corrupted file downloads verified via SHA-256).

#### Slide 23 (`01:48`) — `22. Matching Digests (✓) Suggest Integrity — Or Do They?`
- **Visual:** Green checkmark `✓` beside matched `ae9f013a`.
- **In-depth explanation:** Pivotal transition question: plain hashing prevents **accidental corruption**, NOT **malicious MITM tampering**.

---

### Chapter 4 — The Flaw With Plain Hashing (`Slides 24–25`)

#### Slide 24 (`02:01`) — `23. Problem With Plain Hashing: Think Like an Attacker`
- **Visual:** Big pink brain + Chatty smiling with a lightbulb (`Think...`). *(Note: In the earlier 20-slide deck, Old S6 showed this `Think...` transition frame right before Slide 25's full attack diagram.)*
- **In-depth explanation:** Why can't plain SHA-256 defend against Chatty? Because `SHA-256` is a completely public algorithm with **zero secret key**.

#### Slide 25 `[Old S6]` (`02:07`) — `24. Plain Hash Flaw: Chatty Replaces BOTH Doc & Hash!`
- **Visual:** Confused Joe (`?`), Chatty with lightbulb, and the **red tampered document** paired with its **recomputed hash `430bfe06`**.
- **In-depth explanation:** Chatty simply intercepts JayP's packet, modifies `$100` to `$1000`, deletes `ae9f013a`, runs `SHA-256` on the new payload to compute `430bfe06`, and attaches `430bfe06`. When Joe runs `SHA-256`, he also gets `430bfe06` and **accepts the forged message!** Therefore, unkeyed hashing provides **no cryptographic authentication**.

---

### Chapter 5 — How HMAC Works (`Slides 26–36`)

#### Slide 26 (`02:15`) — `25. Solution: Introducing HMAC`
- **Visual:** Blue binary padlock (`10011 / 11010 / 00100`) + `"Hash Based Message Authentication Code"`.
- **In-depth explanation:** **HMAC** turns an unkeyed cryptographic hash (`SHA-256`) into a **secret-keyed Message Authentication Code**.

#### Slide 27 `[Old S7]` (`02:18`) — `26. HMAC Definition: Hash Function + Secret Key`
- **Visual:** Red `SHA256` funnel + document + yellow secret key + formula `HMAC = hashFunc(secret key + message)`.
- **In-depth explanation:** Introduces the high-level intuition: authenticating a message requires **something only the legitimate sender and receiver know** (the secret key) combined with the message inside the hash. *(Later Slides 48–49 refine why RFC 2104 nests `ipad`/`opad` rather than simple concatenation `H(key || msg)`!)*

#### Slide 28 (`02:26`) — `27. Prerequisite: Both Peers Share Secret Key & Hash`
- **Visual:** Both JayP and Joe hold the identical yellow key + red `SHA256` funnel.
- **In-depth explanation:** Symmetric authentication premise: Alice and Bob agree on both the **algorithm** (`HMAC-SHA256`) and the **shared MAC key** (`K_mac`, completely distinct from `K_enc`). In our app, both browsers derive `K_mac` locally from the shared passphrase + 16-byte room salt (`PBKDF2` bits `256..511`).

#### Slide 29 (`02:33`) — `28. Key & Hash Algorithm Agreed Ahead of Time`
- **Visual:** Notice `"How exchange is made explained in next videos"`.
- **In-depth explanation:** On the web, TLS handshakes negotiate the cipher suite + key via Diffie-Hellman; in our app, key establishment happens cleanly inside `SessionSetup` via PBKDF2-SHA256 (`210k` rounds).

#### Slide 30 `[Old S8]` (`02:43`) — `29. HMAC Creation: Hash Encrypted Text + Secret Key`
- **Visual:** `Encrypted Document + Yellow Secret Key → SHA256`.
- **In-depth explanation:** Notice the critical security order: JayP hashes the **encrypted text** together with the secret key—this is **Encrypt-then-MAC (`EtM`)**, the gold-standard order used in our app (`HMAC-SHA256(K_mac, v ‖ seq ‖ iv ‖ ct)`).

#### Slide 31 (`02:47`) — `30. Generated Output Tag: MAC (db5f0133)`
- **Visual:** Callout `"MAC: Message Authentication Code"` pointing to `(db5f0133)`.
- **In-depth explanation:** The 256-bit (32-byte) output of `HMAC-SHA256` is the **authentication tag** (`macB64` in our envelope). Unlike public hashes, **only holders of `K_mac`** can produce `db5f0133`.

#### Slide 32 `[Old S9]` (`02:51`) — `31. Sending Encrypted Document Alongside MAC (db5f0133)`
- **Visual:** Document + `(db5f0133)` crossing the channel toward Joe.
- **In-depth explanation:** The wire packet carries ciphertext + public metadata (`v`, `seq`, `iv`, `ct`) + the `MAC` tag. `K_mac` itself **never** leaves the browser.

#### Slide 33 (`02:59`) — `32. Attacker Has No Secret Key → Wrong Tag (ae3f0123)`
- **Visual:** Chatty with red `✕` crossing out the yellow key, producing forged red tag `(ae3f0123)`.
- **In-depth explanation:** Chatty wants to alter the message and forge a valid MAC, **but does not know `K_mac`**. Whether Chatty hashes without a key or guesses a random key, he gets `ae3f0123` (`2^{256}` odds against guessing the right 32-byte tag).

#### Slide 34 `[Old S10]` (`03:07`) — `33. Joe Recomputes Expected MAC Using Shared Key`
- **Visual:** Full flow showing JayP sending `(db5f0133)`, Chatty substituting tampered red doc + `(ae3f0123)`, and Joe holding `K_mac` + `SHA256`.
- **In-depth explanation:** In **Encrypt-then-MAC**, Joe runs `HMAC-SHA256(K_mac, receivedPayload)` **before** touching AES decryption. Recomputing yields `db5f0133` only if every single byte matches what JayP sent. *(Our app goes one step further: it computes the MAC on the tampered packet too, getting a totally different `expectedMac` vs `receivedMac`!)*

#### Slide 35 (`03:12`) — `34. MAC Comparison Mismatch (db5f0133 ≠ ae3f0123)`
- **Visual:** Comparison box highlighting `(db5f0133) ≠ (ae3f0123)` at the bottom right.
- **In-depth explanation:** In our app (`ReceiverPipeline.tsx` Step 03 Compare / `constantTimeEqual()`), Bob compares all 32 bytes in **constant time** (`diff |= a[i] ^ b[i]`) without returning early on the first differing byte—preventing **timing side-channel attacks** where an attacker measures nanosecond timing differences to guess valid MAC bytes!

#### Slide 36 (`03:16`) — `35. Tampering Caught Immediately!`
- **Visual:** Scowling Joe catching smug Chatty next to `(db5f0133) ≠ (ae3f0123)`.
- **In-depth explanation:** Because `AES-Decrypt` is never invoked when MAC verification fails, the receiver is immune to silent corruption **and** CBC Padding Oracle attacks (`CO3`).

---

### Chapters 6–9 — Concepts, Algorithms, TLS 1.3 & Standards (`Slides 37–43`)

#### Slide 37 (`03:23`) — `36. Terminology Check: MAC vs HMAC`
- **Visual:** Cartoon figure scratching head between `"MAC ?"` and `"HMAC ?"`.
- **In-depth explanation:** Clears up a common viva question:
  - **MAC** = the *concept/category* of a secret-keyed authentication tag (how you verify Integrity + Authenticity).
  - **HMAC** = one *specific standardized algorithm* that builds a MAC out of any cryptographic hash function (`SHA-256`, `SHA-512`, `SHA-3`, etc.).

#### Slide 38 `[Old S11]` (`03:35`) — `37. MAC Guarantees Both Authenticity & Integrity`
- **Visual:** ID badge (`Authenticity`) + Yellow Key + Magnifying glass (`Integrity`).
- **In-depth explanation:** Ties directly to **CO1 & CO3**:
  1. **Integrity:** Even a 1-bit change invalidates the MAC tag.
  2. **Authenticity:** Proves origin came from a secret-key holder (`JayP`/`Alice`), not an imposter.
  *(Viva bonus note: Because both Alice and Bob share the same symmetric `K_mac`, HMAC provides symmetric authenticity between them, whereas asymmetric Digital Signatures from Practical 04/07 are needed for third-party **Non-Repudiation**.)*

#### Slide 39 `[Old S12]` (`03:44`) — `38. HMAC Is One of Several MAC Algorithms`
- **Visual:** 6 files showing `SipHash`, `BLAKE2`, `CMAC` (block-cipher MAC using AES), `Poly1305`, `GCM` (AEAD), and green highlighted `HMAC`.
- **In-depth explanation:** Good exam context: you can also build MACs from block ciphers (`CBC-MAC`, `CMAC`) or universal hashing (`Poly1305`, `GHASH` in `AES-GCM`). `HMAC` builds on collision-resistant hash primitives instead, making it simple to audit and pluggable across languages/browsers (`Web Crypto API` supports `HMAC` natively).

#### Slide 40 `[Old S13]` (`04:00`) — `39. Real-World Use: HMAC Authenticates TLS 1.3 Finished Messages`
- **Visual:** Sequence arrows (`Client Hello`, `Server Hello + Server Finished + MAC of Handshake`, `Client Finished + MAC of Handshake`).
- **In-depth explanation:** Every HTTPS site you open uses HMAC in **TLS 1.3**: both Client and Server send an HMAC (`Finished` message) covering the entire handshake transcript so an attacker cannot secretly downgrade or alter TLS negotiation messages (`HKDF` in TLS 1.3 is also built on `HMAC`!).

#### Slide 41 `[Old S14]` (`04:13`) — `40. Property 1 — Flexibility: Works With SHA-256, SHA-3 & Other Hashes`
- **Visual:** `SHA256 → a6eg19` funnel beside `SHA-3 → b61g10` funnel.
- **In-depth explanation:** RFC 2104 treats the underlying hash function $H$ as a black box. Even if an older hash like MD5/SHA-1 weakens against collisions, switching `HMAC-SHA1` → `HMAC-SHA256` → `HMAC-SHA3` requires zero change to the HMAC outer/inner wrapper formula.

#### Slide 42 `[Old S15]` (`04:20`) — `41. Property 2 — Standardization: Published as RFC 2104 (Feb 1997)`
- **Visual:** Clipboard with checkmark + gold medal + document `RFC2104 HMAC Feb 1997`.
- **In-depth explanation:** Authored by Mihir Bellare, Ran Canetti, and Hugo Krawczyk (`RFC 2104`, February 1997; also NIST `FIPS 198-1`). Standardization guarantees cross-platform interoperability—identical byte outputs across Python `hmac`, OpenSSL, Node/Bun, and Web Crypto `crypto.subtle`.

#### Slide 43 (`04:31`) — `42. Wide Adoption: VPNs, Web APIs & Online Payment Systems`
- **Visual:** `VPN` padlock + Web Browser window + Payment Card (`1234 5678 9101 1121`).
- **In-depth explanation:** Real-world deployments: IPsec VPN ESP authentication, AWS SigV4 / GitHub Webhook signatures (`X-Hub-Signature-256`), JWT `HS256`, payment gateway callbacks (Razorpay/Stripe), and our Secure Messaging App.

---

### Chapters 10–11 — Security Properties, RFC 2104 Math & Key Mixing (`Slides 44–54`)

#### Slide 44 (`04:33`) — `43. Property 3 — Security: Protected by Secret Key Complexity`
- **Visual:** Big yellow padlock under `"HMAC is very secure"`.
- **In-depth explanation:** Introduces why HMAC stayed unbroken for nearly 30 years even as MD5/SHA-1 failed standalone collision checks.

#### Slide 45 (`04:44`) — `44. HMAC Security Construction Extensively Analyzed`
- **Visual:** Three community figures + binary padlock + magnifying glass.
- **In-depth explanation:** Bellare, Canetti & Krawczyk proved HMAC is a secure **PRF (Pseudorandom Function)** under weaker assumptions (requiring only that the underlying compression function is a PRF—even why `HMAC-SHA1` remained harder to break than raw `SHA-1`!).

#### Slide 46 `[Old S16]` (`04:52`) — `45. Security Property: Pseudorandom Output Sequence (cdae0f...)`
- **Visual:** Output digest `cdae0f0109df1918ead`.
- **In-depth explanation:** **Pseudorandomness** means an HMAC tag is computationally indistinguishable from uniformly random noise to any observer without `K_mac`. Flipping 1 input bit randomizes half the tag bits completely.

#### Slide 47 (`04:56`) — `46. Security Property: Unpredictable Even When Input Text Is Known`
- **Visual:** JayP surrounded by yellow `?` marks looking at `cdae0f0109df1918ead`.
- **In-depth explanation:** Under a **Chosen-Message Attack**, even if Chatty chooses 1 million inputs and collects their genuine HMAC tags from JayP, Chatty still cannot predict the tag for the 1,000,001st message (existential unforgeability).

#### Slide 48 (`05:02`) — `47. Inside RFC 2104 Formula: Nested Hash Using ipad (0x36) & opad (0x5C)`
- **Visual:** Direct excerpt box from **RFC 2104** highlighting `ipad` (`0x36` repeated $B$ times) and `opad` (`0x5C` repeated $B$ times) in red squares + `H(K XOR opad, H(K XOR ipad, text))`.
- **In-depth explanation:**
  - $B$ is the hash input block size (**`64 bytes`** for `SHA-256`).
  - First, $K$ is normalized to **`64` bytes ($K_0$)**: if `< 64` bytes, right-padded with `0x00`; if `> 64` bytes, hashed with SHA-256 down to `32` bytes and then right-padded with `32` `0x00` bytes.
  - Why **`0x36`** and **`0x5C`**? In binary (`00110110` vs `01011100`), they have large Hamming distance (differing in 4 of 8 bits per byte), guaranteeing the inner derived key ($K_0 \oplus \text{ipad}$) and outer derived key ($K_0 \oplus \text{opad}$) behave as two independent secret keys.

#### Slide 49 `[Old S17]` (`05:07`) — `48. Key Modified Twice With XOR Before Inner & Outer Hash Passes`
- **Visual:** RFC 2104 box with both `XOR` operations highlighted in red + red key below.
- **In-depth explanation (5 Exact Steps of HMAC-SHA256):**
  1. Normalize key $K$ to `64` bytes ($K_0$).
  2. Compute Inner Key $S_i = K_0 \oplus \text{ipad}$ (`0x36` $\times 64$).
  3. Compute **Inner Hash**: $H_{\text{in}} = \text{SHA-256}(S_i \parallel \text{text})$ → `32` bytes.
  4. Compute Outer Key $S_o = K_0 \oplus \text{opad}$ (`0x5C` $\times 64$).
  5. Compute **Outer Hash**: $\text{Tag} = \text{SHA-256}(S_o \parallel H_{\text{in}})$ → **`32` bytes (`256` bits)**.
- **Why double-hash defeats Length-Extension Attack (`CO3` Viva Favorite!):** Naive $\text{SHA-256}(K \parallel m)$ leaks internal hash state at the end of $m$, letting attackers append `|| extra_data` to forge a valid tag without knowing $K$! Wrapping with a **second outer hash pass** `H(So || innerHash)` hides the inner state completely and defeats length-extension attacks!

#### Slide 50 `[Old S18]` (`05:16`) — `49. RFC 2104 Strength: Birthday Collision Attack Practically Infeasible`
- **Visual:** Direct RFC 2104 quote underlining `"birthday attack on HMAC is totally impractical."` + 3-candle birthday cake.
- **In-depth explanation:** For unkeyed hashes of length $n$ bits, offline birthday attacks find collisions in $2^{n/2}$ steps (e.g., $2^{80}$ for SHA-1, $2^{128}$ for SHA-256). Because HMAC depends on a secret key unknown to attackers, offline parallel search cannot construct collisions—forcing $2^{128+}$ **online** keyed queries, which is completely infeasible!

#### Slide 51 (`05:31`) — `50. Why Modify the Key? Secret Keys Must Hide Any Patterns`
- **Visual:** Red 3D cube with yellow `?` question marks under `"Why does HMAC modify the key?"`.
- **In-depth explanation:** Transitions to intuition: why does RFC 2104 transform $K$ with `ipad` and `opad` instead of hashing $K$ raw?

#### Slide 52 (`05:34`) — `51. Attacker Exploits Repeated Key Patterns Without Mixing`
- **Visual:** Red `?` cube + smiling attacker Chatty.
- **In-depth explanation:** Keys padded solely with zeroes or derived from human strings contain structured/predictable byte positions. Bitwise XORing every byte across the entire 64-byte block with `0x36`/`0x5C` diffuses key entropy uniformly into SHA-256's initial compression blocks.

#### Slide 53 (`05:41`) — `52. Why ipad & opad Values Are Essential in Every HMAC Run`
- **Visual:** Pointing finger emphasizing `ipad` & `opad`.
- **In-depth explanation:** Reinforces that skipping either mask (`0x36` / `0x5C`) or dropping the outer pass weakens domain separation between inner and outer passes and breaks compliance with RFC 2104.

#### Slide 54 `[Old S19]` (`05:49`) — `53. Mixing Analogy: ipad & opad Wash & Randomize the Key Structure`
- **Visual:** Teal washing machine mixing the bright cyan secret key inside its drum.
- **In-depth explanation:** Clean closing metaphor: `ipad` + `opad` + double SHA-256 thoroughly tumble and mix $K$ across both hash passes so no patterns survive and the resulting 32-byte tag uniquely seals your message.

---

### Slide 55 `[Old S20]` — `THANK YOU` & Live App Connection
- **Visual:** Charcoal closing slide connecting directly to our live project files ([`src/lib/crypto.ts`](../src/lib/crypto.ts) & [`src/screens/ReceiverPipeline.tsx`](../src/screens/ReceiverPipeline.tsx)).
- **Complete Practical 08 Pipeline Inside Our Secure Messaging App:**
  1. **Domain-Separated Keys (`CO2`):** `PBKDF2-HMAC-SHA256` (`210,000` rounds + 16B random salt) splits `512` bits into `K_enc` (`AES-256-CBC`) and `K_mac` (`HMAC-SHA256`) so the AES key is **never** reused for HMAC.
  2. **Canonical MAC Input:** Signs **`VERSION (1B) ‖ SEQ (8B) ‖ IV (16B) ‖ CIPHERTEXT (N bytes)`** — protecting not only ciphertext, but also protocol version, sequence counter (`seq`), and random `IV`.
  3. **Encrypt-then-MAC Gate (`CO3`):** Bob's `ReceiverPipeline` recomputes expected MAC, runs constant-time comparison (`constantTimeEqual()`), and aborts **before** running `AES-256-CBC` decrypt if even 1 bit differs (**Tamper Lab demo**: click `Tamper next message` → `Rejected`).
  4. **Anti-Replay Ledger:** Even if an attacker replays an unmodified valid packet (whose HMAC tag still matches!), Bob checks `seq` against previously accepted sequence numbers and drops duplicates (**Replay Lab demo**: click `Replay last` → `Replay detected`).

---

## Top Practical 08 Viva Questions & Crisp Answers
1. **Why can't we use AES alone without HMAC?**  
   *AES gives Confidentiality, not Integrity. An attacker can flip bits in ciphertext so Bob silently decrypts corrupted text (`$100` → `$1000`).*
2. **Why can't we use plain SHA-256 (`SHA-256(msg)`) instead of HMAC?**  
   *SHA-256 has no secret key—an attacker can edit the message AND recompute a brand-new matching SHA-256 digest.*
3. **Why does RFC 2104 use two hash passes (`ipad = 0x36`, `opad = 0x5C`) instead of `SHA-256(key || msg)`?**  
   *Because naive `H(key || msg)` in Merkle-Damgård hashes like SHA-256 is vulnerable to **Length-Extension Attacks**. Nesting inner hash (`0x36`) inside outer hash (`0x5C`) seals the internal state and makes length-extension impossible.*
4. **Why do we use Encrypt-then-MAC instead of MAC-then-Encrypt?**  
   *Verifying HMAC over ciphertext BEFORE running `AES-Decrypt` drops modified/malicious packets immediately and eliminates decryption-time CBC Padding Oracle attacks.*
5. **Can HMAC alone stop Replay Attacks?**  
   *No! A replayed old packet has a completely valid HMAC tag. That is why our envelope binds an 8-byte incrementing `seq` counter inside the HMAC input and checks Bob's receiver ledger before decrypting.*
