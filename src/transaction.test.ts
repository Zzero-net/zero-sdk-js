import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { toHex, fromHex, buildTransfer, signTransfer, parseTransfer } from "./transaction.js";
import { TX_SIZE, PUBKEY_SIZE, MAX_TRANSFER_UNITS } from "./constants.js";

describe("toHex / fromHex", () => {
  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it("produces lowercase hex", () => {
    expect(toHex(new Uint8Array([0xab, 0xcd]))).toBe("abcd");
  });

  it("rejects odd-length hex", () => {
    expect(() => fromHex("abc")).toThrow("even length");
  });

  it("rejects invalid hex characters", () => {
    expect(() => fromHex("zzzz")).toThrow("Invalid hex");
  });
});

describe("buildTransfer", () => {
  const from = new Uint8Array(PUBKEY_SIZE).fill(1);
  const to = new Uint8Array(PUBKEY_SIZE).fill(2);

  it("returns 72 bytes", () => {
    const tx = buildTransfer(from, to, 100, 0);
    expect(tx.length).toBe(72);
  });

  it("accepts hex string keys", () => {
    const tx = buildTransfer(toHex(from), toHex(to), 100, 0);
    expect(tx.length).toBe(72);
  });

  it("encodes amount and nonce as little-endian uint32", () => {
    const tx = buildTransfer(from, to, 256, 42);
    const view = new DataView(tx.buffer, tx.byteOffset, tx.byteLength);
    expect(view.getUint32(64, true)).toBe(256);
    expect(view.getUint32(68, true)).toBe(42);
  });

  it("rejects amount > MAX_TRANSFER_UNITS", () => {
    expect(() => buildTransfer(from, to, MAX_TRANSFER_UNITS + 1, 0)).toThrow();
  });

  it("rejects amount <= 0", () => {
    expect(() => buildTransfer(from, to, 0, 0)).toThrow();
    expect(() => buildTransfer(from, to, -1, 0)).toThrow();
  });

  it("rejects wrong key length", () => {
    expect(() => buildTransfer(new Uint8Array(16), to, 100, 0)).toThrow();
  });
});

describe("signTransfer", () => {
  it("produces a 136-byte signed transaction with full signature", () => {
    const kp = nacl.sign.keyPair();
    const unsigned = buildTransfer(kp.publicKey, new Uint8Array(PUBKEY_SIZE).fill(2), 100, 0);
    const signed = signTransfer(unsigned, kp.secretKey);
    expect(signed.length).toBe(136); // 72 payload + 64 full Ed25519 signature
  });

  it("preserves payload in the first 72 bytes", () => {
    const kp = nacl.sign.keyPair();
    const unsigned = buildTransfer(kp.publicKey, new Uint8Array(PUBKEY_SIZE).fill(2), 500, 7);
    const signed = signTransfer(unsigned, kp.secretKey);
    expect(signed.subarray(0, 72)).toEqual(unsigned);
  });
});

describe("parseTransfer", () => {
  it("round-trips build → sign → parse with full signature", () => {
    const kp = nacl.sign.keyPair();
    const to = new Uint8Array(PUBKEY_SIZE).fill(0xaa);
    const unsigned = buildTransfer(kp.publicKey, to, 1234, 99);
    const signed = signTransfer(unsigned, kp.secretKey);
    const parsed = parseTransfer(signed);

    expect(parsed.fromHex).toBe(toHex(kp.publicKey));
    expect(parsed.toHex).toBe(toHex(to));
    expect(parsed.amount).toBe(1234);
    expect(parsed.nonce).toBe(99);
    expect(parsed.signature.length).toBe(64); // full Ed25519 signature
  });

  it("rejects wrong buffer size", () => {
    expect(() => parseTransfer(new Uint8Array(50))).toThrow("136 or 100 bytes");
  });
});
