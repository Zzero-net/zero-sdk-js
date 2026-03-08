import { DEFAULT_RPC, DEFAULT_FAUCET } from "./constants.js";
import { toHex } from "./transaction.js";

/**
 * Network status response.
 */
export interface NetworkStatus {
  /** Current block height */
  height: number;
  /** Total number of accounts */
  accounts: number;
  /** Total number of transactions */
  transactions: number;
  /** Node version string */
  version: string;
  /** Any additional fields from the API */
  [key: string]: unknown;
}

/**
 * Account balance response.
 */
export interface BalanceResponse {
  /** Account public key (hex) */
  address: string;
  /** Balance in internal units */
  balance: number;
}

/**
 * Full account state response.
 */
export interface AccountState {
  /** Account public key (hex) */
  address: string;
  /** Balance in internal units */
  balance: number;
  /** Current nonce (number of outgoing transactions) */
  nonce: number;
  /** Head transaction hash (hex), or null for new accounts */
  head: string | null;
  /** Any additional fields from the API */
  [key: string]: unknown;
}

/**
 * A single transaction record in history.
 */
export interface TransactionRecord {
  /** Sender public key (hex) */
  from: string;
  /** Recipient public key (hex) */
  to: string;
  /** Amount in internal units */
  amount: number;
  /** Transaction hash (hex) */
  hash: string;
  /** Timestamp (ISO string or unix) */
  timestamp: string | number;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Transaction submission response.
 */
export interface SendResponse {
  /** Whether the transaction was accepted */
  ok: boolean;
  /** Transaction hash if accepted */
  hash?: string;
  /** Error message if rejected */
  error?: string;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Faucet response.
 */
export interface FaucetResponse {
  /** Whether the faucet request succeeded */
  ok: boolean;
  /** Transaction hash of the faucet send */
  hash?: string;
  /** Error message if failed */
  error?: string;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Low-level HTTP client for the Zero Network JSON API.
 *
 * Uses the standard `fetch` API, compatible with Node.js 18+ and browsers.
 *
 * @example
 * ```ts
 * const client = new ZeroClient();
 * const status = await client.status();
 * console.log("Block height:", status.height);
 * ```
 */
export class ZeroClient {
  /** RPC base URL (no trailing slash) */
  readonly rpc: string;
  /** Faucet base URL (no trailing slash) */
  readonly faucetUrl: string;

  /**
   * Create a new ZeroClient.
   *
   * @param rpc - RPC endpoint URL (defaults to https://rpc.zzero.net)
   * @param faucetUrl - Faucet endpoint URL (defaults to testnet faucet)
   */
  constructor(rpc: string = DEFAULT_RPC, faucetUrl: string = DEFAULT_FAUCET) {
    this.rpc = rpc.replace(/\/+$/, "");
    this.faucetUrl = faucetUrl.replace(/\/+$/, "");
  }

  /**
   * Get network status.
   *
   * @returns Network status including block height, account count, and version
   */
  async status(): Promise<NetworkStatus> {
    const res = await fetch(`${this.rpc}/api/status`);
    if (!res.ok) {
      throw new Error(`Status request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<NetworkStatus>;
  }

  /**
   * Get the balance for an account.
   *
   * @param pubkey - Public key as hex string or Uint8Array
   * @returns Balance response with address and balance in units
   */
  async balance(pubkey: string | Uint8Array): Promise<BalanceResponse> {
    const hex = typeof pubkey === "string" ? pubkey : toHex(pubkey);
    const res = await fetch(`${this.rpc}/api/balance/${hex}`);
    if (!res.ok) {
      throw new Error(`Balance request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<BalanceResponse>;
  }

  /**
   * Get the full account state including balance, nonce, and head hash.
   *
   * @param pubkey - Public key as hex string or Uint8Array
   * @returns Full account state
   */
  async account(pubkey: string | Uint8Array): Promise<AccountState> {
    const hex = typeof pubkey === "string" ? pubkey : toHex(pubkey);
    const res = await fetch(`${this.rpc}/api/account/${hex}`);
    if (!res.ok) {
      throw new Error(`Account request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<AccountState>;
  }

  /**
   * Get transaction history for an account.
   *
   * @param pubkey - Public key as hex string or Uint8Array
   * @param limit - Maximum number of transactions to return
   * @returns Array of transaction records
   */
  async history(
    pubkey: string | Uint8Array,
    limit?: number
  ): Promise<TransactionRecord[]> {
    const hex = typeof pubkey === "string" ? pubkey : toHex(pubkey);
    let url = `${this.rpc}/api/history/${hex}`;
    if (limit !== undefined) {
      url += `?limit=${limit}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`History request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<TransactionRecord[]>;
  }

  /**
   * Submit a signed transaction to the network.
   *
   * @param txBytes - Complete 100-byte signed transaction
   * @returns Submission response with acceptance status and hash
   */
  async send(txBytes: Uint8Array): Promise<SendResponse> {
    const res = await fetch(`${this.rpc}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: txBytes,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Send failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<SendResponse>;
  }

  /**
   * Request testnet Z from the faucet.
   *
   * @param address - Public key as hex string or Uint8Array
   * @returns Faucet response
   */
  async faucet(address: string | Uint8Array): Promise<FaucetResponse> {
    const hex = typeof address === "string" ? address : toHex(address);
    const res = await fetch(`${this.faucetUrl}/faucet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: hex }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Faucet request failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<FaucetResponse>;
  }
}
