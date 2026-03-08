import nacl from "tweetnacl";
import { ZeroClient } from "./client.js";
import type {
  AccountState,
  BalanceResponse,
  FaucetResponse,
  SendResponse,
  TransactionRecord,
} from "./client.js";
import {
  UNITS_PER_Z,
  MAX_TRANSFER_Z,
  ED25519_SEED_SIZE,
  DEFAULT_RPC,
  DEFAULT_FAUCET,
} from "./constants.js";
import {
  buildTransfer,
  signTransfer,
  toHex,
  fromHex,
} from "./transaction.js";

/**
 * A Zero Network wallet backed by an Ed25519 keypair.
 *
 * Provides high-level methods for sending Z, checking balances,
 * and interacting with the network.
 *
 * @example
 * ```ts
 * // Create a new wallet
 * const wallet = Wallet.create();
 * console.log("Address:", wallet.address);
 * console.log("Seed (backup):", wallet.seedHex);
 *
 * // Send Z
 * const result = await wallet.send("recipient_pubkey_hex", 1.5);
 * console.log("TX hash:", result.hash);
 * ```
 */
export class Wallet {
  /** Ed25519 keypair (public + secret key) */
  private readonly keypair: nacl.SignKeyPair;
  /** Zero Network RPC client */
  readonly client: ZeroClient;

  private constructor(keypair: nacl.SignKeyPair, client: ZeroClient) {
    this.keypair = keypair;
    this.client = client;
  }

  /**
   * Generate a new random wallet.
   *
   * @param rpc - RPC endpoint URL (defaults to https://rpc.zzero.net)
   * @param faucetUrl - Faucet endpoint URL (defaults to testnet faucet)
   * @returns A new Wallet with a fresh Ed25519 keypair
   */
  static create(rpc?: string, faucetUrl?: string): Wallet {
    const keypair = nacl.sign.keyPair();
    return new Wallet(keypair, new ZeroClient(rpc, faucetUrl));
  }

  /**
   * Restore a wallet from a 32-byte seed (hex encoded).
   *
   * @param seedHex - 64-character hex string of the Ed25519 seed
   * @param rpc - RPC endpoint URL (defaults to https://rpc.zzero.net)
   * @param faucetUrl - Faucet endpoint URL (defaults to testnet faucet)
   * @returns Wallet restored from the seed
   * @throws Error if the seed is not 32 bytes
   */
  static fromSeed(seedHex: string, rpc?: string, faucetUrl?: string): Wallet {
    const seed = fromHex(seedHex);
    if (seed.length !== ED25519_SEED_SIZE) {
      throw new Error(
        `Seed must be ${ED25519_SEED_SIZE} bytes (${ED25519_SEED_SIZE * 2} hex chars), got ${seed.length}`
      );
    }
    const keypair = nacl.sign.keyPair.fromSeed(seed);
    return new Wallet(keypair, new ZeroClient(rpc, faucetUrl));
  }

  /**
   * Create a wallet from the ZERO_KEY environment variable.
   *
   * The env var should contain a 64-character hex seed.
   * Only works in Node.js environments.
   *
   * @param rpc - RPC endpoint URL (defaults to https://rpc.zzero.net)
   * @param faucetUrl - Faucet endpoint URL (defaults to testnet faucet)
   * @returns Wallet restored from ZERO_KEY
   * @throws Error if ZERO_KEY is not set or invalid
   */
  static fromEnv(rpc?: string, faucetUrl?: string): Wallet {
    if (typeof process === "undefined" || !process.env) {
      throw new Error("fromEnv() is only available in Node.js environments");
    }
    const key = process.env.ZERO_KEY;
    if (!key) {
      throw new Error("ZERO_KEY environment variable is not set");
    }
    return Wallet.fromSeed(key, rpc, faucetUrl);
  }

  /**
   * The wallet's public address as a hex string (64 characters).
   */
  get address(): string {
    return toHex(this.keypair.publicKey);
  }

  /**
   * The wallet's public key as raw bytes.
   */
  get publicKey(): Uint8Array {
    return this.keypair.publicKey;
  }

  /**
   * The wallet's seed as a hex string (64 characters).
   *
   * This is the secret material needed to restore the wallet.
   * Keep it safe and never share it.
   */
  get seedHex(): string {
    // tweetnacl secretKey is seed(32) + publicKey(32) = 64 bytes
    // The seed is the first 32 bytes
    return toHex(this.keypair.secretKey.subarray(0, ED25519_SEED_SIZE));
  }

  /**
   * Send Z to another address.
   *
   * Automatically fetches the current nonce, builds the transaction,
   * signs it, and submits it to the network.
   *
   * @param to - Recipient public key as hex string or Uint8Array
   * @param amountZ - Amount in Z (e.g., 1.5 for 1.50 Z = $0.015)
   * @returns Transaction submission response
   * @throws Error if amount exceeds maximum or is invalid
   *
   * @example
   * ```ts
   * const result = await wallet.send("abcd1234...", 2.0);
   * if (result.ok) {
   *   console.log("Sent! Hash:", result.hash);
   * }
   * ```
   */
  async send(to: string | Uint8Array, amountZ: number): Promise<SendResponse> {
    if (amountZ <= 0) {
      throw new Error("Amount must be positive");
    }
    if (amountZ > MAX_TRANSFER_Z) {
      throw new Error(
        `Amount ${amountZ} Z exceeds maximum of ${MAX_TRANSFER_Z} Z`
      );
    }

    const amountUnits = Math.round(amountZ * UNITS_PER_Z);
    if (amountUnits <= 0) {
      throw new Error("Amount too small — minimum is 0.01 Z (1 unit)");
    }

    // Fetch current nonce
    const acct = await this.client.account(this.address);
    const nonce = acct.nonce;

    // Build and sign the transaction
    const toBytes = typeof to === "string" ? to : toHex(to);
    const unsigned = buildTransfer(
      this.keypair.publicKey,
      toBytes,
      amountUnits,
      nonce
    );
    const signed = signTransfer(unsigned, this.keypair.secretKey);

    // Submit
    return this.client.send(signed);
  }

  /**
   * Get the wallet's current balance in Z.
   *
   * @returns Balance response (balance is in internal units; divide by 100 for Z)
   */
  async balance(): Promise<BalanceResponse> {
    return this.client.balance(this.address);
  }

  /**
   * Get the wallet's full account state (balance, nonce, head).
   *
   * @returns Account state
   */
  async account(): Promise<AccountState> {
    return this.client.account(this.address);
  }

  /**
   * Get the wallet's transaction history.
   *
   * @param limit - Maximum number of transactions to return
   * @returns Array of transaction records
   */
  async history(limit?: number): Promise<TransactionRecord[]> {
    return this.client.history(this.address, limit);
  }

  /**
   * Request testnet Z from the faucet.
   *
   * @returns Faucet response
   */
  async faucet(): Promise<FaucetResponse> {
    return this.client.faucet(this.address);
  }
}
