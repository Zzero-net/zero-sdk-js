import nacl from "tweetnacl";
import {
  TX_SIZE,
  PUBKEY_SIZE,
  SIG_SIZE,
  AMOUNT_SIZE,
  NONCE_SIZE,
  ED25519_SIG_SIZE,
  MAX_TRANSFER_UNITS,
} from "./constants.js";

/**
 * Parsed representation of a Zero Network transfer transaction.
 */
export interface ParsedTransfer {
  /** Sender public key (32 bytes) */
  from: Uint8Array;
  /** Recipient public key (32 bytes) */
  to: Uint8Array;
  /** Transfer amount in internal units */
  amount: number;
  /** Sender's nonce */
  nonce: number;
  /** Ed25519 signature (64 bytes full, or 28 bytes legacy truncated) */
  signature: Uint8Array;
  /** Sender public key as hex string */
  fromHex: string;
  /** Recipient public key as hex string */
  toHex: string;
}

/**
 * Convert a Uint8Array to a hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hex string to a Uint8Array.
 * @throws Error if the hex string has an odd length or contains invalid characters.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/**
 * Build an unsigned transfer transaction buffer.
 *
 * Layout (72 bytes unsigned, 100 bytes signed):
 * - from[32]: sender public key
 * - to[32]: recipient public key
 * - amount[4]: uint32 LE amount in units
 * - nonce[4]: uint32 LE sender nonce
 *
 * @param fromPub - Sender public key (32 bytes or 64-char hex)
 * @param toPub - Recipient public key (32 bytes or 64-char hex)
 * @param amountUnits - Amount in internal units (1-2500)
 * @param nonce - Sender account nonce
 * @returns 72-byte Uint8Array (unsigned transaction, without signature)
 * @throws Error if amount exceeds max or keys are invalid
 */
export function buildTransfer(
  fromPub: Uint8Array | string,
  toPub: Uint8Array | string,
  amountUnits: number,
  nonce: number
): Uint8Array {
  const from = typeof fromPub === "string" ? fromHex(fromPub) : fromPub;
  const to = typeof toPub === "string" ? fromHex(toPub) : toPub;

  if (from.length !== PUBKEY_SIZE) {
    throw new Error(`Sender public key must be ${PUBKEY_SIZE} bytes`);
  }
  if (to.length !== PUBKEY_SIZE) {
    throw new Error(`Recipient public key must be ${PUBKEY_SIZE} bytes`);
  }
  if (amountUnits <= 0 || amountUnits > MAX_TRANSFER_UNITS) {
    throw new Error(
      `Amount must be between 1 and ${MAX_TRANSFER_UNITS} units`
    );
  }
  if (nonce < 0 || !Number.isInteger(nonce)) {
    throw new Error("Nonce must be a non-negative integer");
  }

  // 32 (from) + 32 (to) + 4 (amount) + 4 (nonce) = 72 bytes
  const buf = new Uint8Array(PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE + NONCE_SIZE);
  buf.set(from, 0);
  buf.set(to, PUBKEY_SIZE);

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint32(PUBKEY_SIZE + PUBKEY_SIZE, amountUnits, true); // little-endian
  view.setUint32(PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE, nonce, true);

  return buf;
}

/**
 * Sign an unsigned transfer and return the complete 136-byte transaction.
 *
 * The signature is computed over the 72-byte unsigned payload using Ed25519.
 * The full 64-byte signature is appended (required by the validator).
 *
 * @param unsignedTx - 72-byte unsigned transaction from {@link buildTransfer}
 * @param secretKey - Ed25519 secret key (64 bytes, as returned by tweetnacl keypair)
 * @returns 136-byte signed transaction ready for submission
 * @throws Error if inputs have wrong sizes
 */
export function signTransfer(
  unsignedTx: Uint8Array,
  secretKey: Uint8Array
): Uint8Array {
  const expectedUnsignedSize = PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE + NONCE_SIZE;
  if (unsignedTx.length !== expectedUnsignedSize) {
    throw new Error(
      `Unsigned transaction must be ${expectedUnsignedSize} bytes, got ${unsignedTx.length}`
    );
  }
  if (secretKey.length !== ED25519_SIG_SIZE) {
    throw new Error(
      `Secret key must be ${ED25519_SIG_SIZE} bytes, got ${secretKey.length}`
    );
  }

  // Sign the 72-byte payload
  const fullSig = nacl.sign.detached(unsignedTx, secretKey);

  // Build complete 136-byte transaction: payload(72) + full_sig(64) = 136
  const tx = new Uint8Array(expectedUnsignedSize + ED25519_SIG_SIZE);
  tx.set(unsignedTx, 0);
  tx.set(fullSig, expectedUnsignedSize);

  return tx;
}

/**
 * Parse a signed transaction buffer into its components.
 * Accepts 136-byte (full signature) or 100-byte (truncated, legacy) format.
 *
 * @param txBytes - Transaction buffer
 * @returns Parsed transaction fields
 * @throws Error if buffer size is invalid
 */
export function parseTransfer(txBytes: Uint8Array): ParsedTransfer {
  const FULL_TX_SIZE = PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE + NONCE_SIZE + ED25519_SIG_SIZE; // 136
  if (txBytes.length !== FULL_TX_SIZE && txBytes.length !== TX_SIZE) {
    throw new Error(`Transaction must be ${FULL_TX_SIZE} or ${TX_SIZE} bytes, got ${txBytes.length}`);
  }

  const from = txBytes.slice(0, PUBKEY_SIZE);
  const to = txBytes.slice(PUBKEY_SIZE, PUBKEY_SIZE + PUBKEY_SIZE);

  const view = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
  const amount = view.getUint32(PUBKEY_SIZE + PUBKEY_SIZE, true);
  const nonce = view.getUint32(PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE, true);

  const sigOffset = PUBKEY_SIZE + PUBKEY_SIZE + AMOUNT_SIZE + NONCE_SIZE;
  const sigSize = txBytes.length === FULL_TX_SIZE ? ED25519_SIG_SIZE : SIG_SIZE;
  const signature = txBytes.slice(sigOffset, sigOffset + sigSize);

  return {
    from,
    to,
    amount,
    nonce,
    signature,
    fromHex: toHex(from),
    toHex: toHex(to),
  };
}
