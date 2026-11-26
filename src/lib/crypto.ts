/**
 * Cryptographic core — Secure Messaging System
 * ---------------------------------------------
 * Practical 03 : Symmetric Key Cryptography  -> AES-256-CBC (PKCS#7 padding)
 * Practical 08 : Message Authentication      -> HMAC-SHA256
 *
 * Construction — encrypt-then-MAC over an untrusted relay:
 *
 *   MAC input = VERSION(1 byte) || SEQ(8 bytes, big-endian) || IV(16) || CIPHERTEXT(n)
 *   MAC       = HMAC-SHA256(K_mac, MAC input)
 *   envelope  = { v, seq, ivB64, ctB64, macB64 }
 *
 * The relay only ever sees that envelope. Keys are derived in the browser with
 * PBKDF2-HMAC-SHA256 and never leave the tab. Every primitive below is the
 * browser's Web Crypto API — no third-party crypto library and no stand-ins.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const WIRE_VERSION = 1;
export const IV_BYTES = 16; // AES block size / CBC initialisation vector
export const MAC_BYTES = 32; // HMAC-SHA256 output
export const KEY_BYTES = 32; // AES-256 key
export const SALT_BYTES = 16;
export const PBKDF2_ITERATIONS = 210_000;

/** TypeScript's newer lib types distinguish ArrayBuffer from typed-array views. */
const bs = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource;

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 1) out += view[i].toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex string must have an even number of characters.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function newRoomSalt(): string {
  return toBase64(randomBytes(SALT_BYTES));
}

/** "9f3a1c…b02e" — long hex made readable without flooding the layout. */
export function shortHex(hex: string, head = 20, tail = 8): string {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length <= head + tail + 1) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

export function groupHex(hex: string, size = 2, gap = " "): string {
  return (hex.match(new RegExp(`.{1,${size}}`, "g")) ?? []).join(gap);
}

/* ------------------------------------------------------------------ */
/* Envelope                                                           */
/* ------------------------------------------------------------------ */

export interface Envelope {
  v: number;
  seq: number;
  ivB64: string;
  ctB64: string;
  macB64: string;
}

export function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const env = value as Record<string, unknown>;
  return (
    env.v === WIRE_VERSION &&
    typeof env.seq === "number" &&
    Number.isSafeInteger(env.seq) &&
    env.seq > 0 &&
    typeof env.ivB64 === "string" &&
    typeof env.ctB64 === "string" &&
    typeof env.macB64 === "string"
  );
}

export function envelopeBytes(env: Envelope): { iv: Uint8Array; ct: Uint8Array; mac: Uint8Array } {
  const iv = fromBase64(env.ivB64);
  const ct = fromBase64(env.ctB64);
  const mac = fromBase64(env.macB64);
  if (iv.length !== IV_BYTES) throw new Error("Envelope IV must be 16 bytes (AES block size).");
  if (ct.length === 0 || ct.length % IV_BYTES !== 0) throw new Error("Ciphertext length is not a whole number of AES blocks.");
  return { iv, ct, mac };
}

/** Everything the MAC covers, in order: version, sequence number, IV, ciphertext. */
export function macInput(env: Envelope): Uint8Array {
  const { iv, ct } = envelopeBytes(env);
  const out = new Uint8Array(1 + 8 + iv.length + ct.length);
  out[0] = WIRE_VERSION;
  new DataView(out.buffer).setBigUint64(1, BigInt(env.seq));
  out.set(iv, 9);
  out.set(ct, 9 + iv.length);
  return out;
}

/* ------------------------------------------------------------------ */
/* Key derivation (PBKDF2-HMAC-SHA256)                                 */
/* ------------------------------------------------------------------ */

export interface SessionKeys {
  encKey: CryptoKey;
  macKey: CryptoKey;
  fingerprint: string;
  saltB64: string;
  iterations: number;
}

async function keyFingerprint(encRaw: Uint8Array, macRaw: Uint8Array): Promise<string> {
  const combined = new Uint8Array(encRaw.length + macRaw.length);
  combined.set(encRaw, 0);
  combined.set(macRaw, encRaw.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bs(combined)));
  return (toHex(digest.slice(0, 8)).match(/.{1,4}/g) ?? []).join(" ").toUpperCase();
}

/**
 * Stretch the shared passphrase into two independent 256-bit keys.
 * 512 bits are derived, then split: first 32 bytes -> K_enc, last 32 -> K_mac.
 * Non-extractable CryptoKeys: the raw key material is not exported anywhere.
 */
export async function deriveKeys(passphrase: string, saltB64: string): Promise<SessionKeys> {
  const salt = fromBase64(saltB64);
  const baseKey = await crypto.subtle.importKey("raw", bs(encoder.encode(passphrase.normalize("NFKC"))), "PBKDF2", false, [
    "deriveBits",
  ]);

  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: bs(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      baseKey,
      512,
    ),
  );

  const encRaw = bits.slice(0, KEY_BYTES);
  const macRaw = bits.slice(KEY_BYTES, KEY_BYTES * 2);

  const encKey = await crypto.subtle.importKey("raw", bs(encRaw), { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
  const macKey = await crypto.subtle.importKey("raw", bs(macRaw), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

  return {
    encKey,
    macKey,
    fingerprint: await keyFingerprint(encRaw, macRaw),
    saltB64,
    iterations: PBKDF2_ITERATIONS,
  };
}

/* ------------------------------------------------------------------ */
/* Sealing                                                             */
/* ------------------------------------------------------------------ */

export interface SealedEnvelope {
  envelope: Envelope;
  ivHex: string;
  ctHex: string;
  macHex: string;
  macInputHex: string;
  ctBytes: number;
  paddingBytes: number;
  encryptMs: number;
}

/** AES-256-CBC encrypt (Web Crypto applies PKCS#7 padding), then HMAC-SHA256 the envelope. */
export async function sealMessage(plaintext: string, keys: SessionKeys, seq: number): Promise<SealedEnvelope> {
  const started = performance.now();
  const plainBytes = encoder.encode(plaintext);
  if (plainBytes.length === 0) throw new Error("Cannot seal an empty message.");

  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv: bs(iv) }, keys.encKey, bs(plainBytes)),
  );

  const envelope: Envelope = {
    v: WIRE_VERSION,
    seq,
    ivB64: toBase64(iv),
    ctB64: toBase64(ct),
    macB64: "",
  };

  const input = macInput(envelope);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", keys.macKey, bs(input)));
  envelope.macB64 = toBase64(mac);

  return {
    envelope,
    ivHex: toHex(iv),
    ctHex: toHex(ct),
    macHex: toHex(mac),
    macInputHex: toHex(input),
    ctBytes: ct.length,
    paddingBytes: ct.length - plainBytes.length,
    encryptMs: performance.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* Verification and decryption                                         */
/* ------------------------------------------------------------------ */

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface MacCheck {
  valid: boolean;
  receivedMacHex: string;
  computedMacHex: string;
  macInputHex: string;
  differingBits: number;
  ms: number;
}

/** Recompute the tag from the envelope and compare it with the tag that arrived. */
export async function verifyMac(envelope: Envelope, keys: SessionKeys): Promise<MacCheck> {
  const started = performance.now();
  const input = macInput(envelope);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", keys.macKey, bs(input)));
  const received = envelopeBytes(envelope).mac;
  return {
    valid: constantTimeEqual(expected, received),
    receivedMacHex: toHex(received),
    computedMacHex: toHex(expected),
    macInputHex: toHex(input),
    differingBits: countDifferingBits(expected, received),
    ms: performance.now() - started,
  };
}

/** Only call this after verifyMac() returned valid. */
export async function decryptEnvelope(envelope: Envelope, keys: SessionKeys): Promise<{ plaintext: string; ms: number }> {
  const started = performance.now();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: bs(fromBase64(envelope.ivB64)) },
    keys.encKey,
    bs(fromBase64(envelope.ctB64)),
  );
  return { plaintext: decoder.decode(plain), ms: performance.now() - started };
}

/* ------------------------------------------------------------------ */
/* Attack helpers — real mutations, no fake outcomes                    */
/* ------------------------------------------------------------------ */

export function countDifferingBits(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  let bits = 0;
  for (let i = 0; i < length; i += 1) {
    let x = a[i] ^ b[i];
    while (x) {
      bits += x & 1;
      x >>= 1;
    }
  }
  return bits + Math.abs(a.length - b.length) * 8;
}

export function flipCiphertextBit(envelope: Envelope, offset?: number): Envelope {
  const ct = fromBase64(envelope.ctB64);
  const index = offset ?? Math.max(0, Math.floor(ct.length / 2));
  ct[index] ^= 0x01;
  return { ...envelope, ctB64: toBase64(ct) };
}

export function flipMacBit(envelope: Envelope): Envelope {
  const mac = fromBase64(envelope.macB64);
  mac[0] ^= 0x01;
  return { ...envelope, macB64: toBase64(mac) };
}

export function diffHex(a: string, b: string): string[] {
  const left = a.replace(/\s+/g, "");
  const right = b.replace(/\s+/g, "");
  const out: string[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) out.push(`byte ${Math.floor(i / 2)}`);
    if (out.length >= 6) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export function formatBytes(n: number): string {
  return n === 1 ? "1 byte" : `${n} bytes`;
}

export function seqLabel(seq: number): string {
  return `#${String(seq).padStart(3, "0")}`;
}
