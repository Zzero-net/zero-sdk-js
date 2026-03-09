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
 * Bridge-in request: notify Zero that tokens were locked on an external chain.
 */
export interface BridgeInRequest {
  /** Source chain identifier (e.g. "ethereum", "solana") */
  source_chain: string;
  /** Token symbol or contract address on the source chain */
  token: string;
  /** Lock transaction hash on the source chain */
  tx_hash: string;
  /** Recipient address on the Zero Network (hex) */
  zero_recipient: string;
}

/**
 * Bridge-in response returned after submitting a bridge-in request.
 */
export interface BridgeInResponse {
  /** Unique bridge operation identifier */
  bridge_id: string;
  /** Current status of the bridge operation */
  status: string;
  /** Amount of Z minted / to be minted */
  z_amount: number;
}

/**
 * Bridge-out request: withdraw Z back to an external chain.
 */
export interface BridgeOutRequest {
  /** Destination chain identifier (e.g. "ethereum", "solana") */
  dest_chain: string;
  /** Token symbol or contract address on the destination chain */
  token: string;
  /** Recipient address on the destination chain */
  dest_address: string;
  /** Amount of Z to bridge out */
  z_amount: number;
  /** Sender address on the Zero Network (hex) */
  from: string;
  /** Ed25519 signature authorising the withdrawal (hex) */
  signature: string;
}

/**
 * Bridge-out response returned after submitting a bridge-out request.
 */
export interface BridgeOutResponse {
  /** Unique bridge operation identifier */
  bridge_id: string;
  /** Current status of the bridge operation */
  status: string;
}

/**
 * Bridge status response with full details of a bridge operation.
 */
export interface BridgeStatusResponse {
  /** Unique bridge operation identifier */
  bridge_id: string;
  /** Direction of the bridge ("in" or "out") */
  direction: string;
  /** Current status of the bridge operation */
  status: string;
  /** Source chain identifier */
  source_chain: string;
  /** Token symbol or contract address */
  token: string;
  /** Amount of Z involved */
  z_amount: number;
  /** Number of attestations received so far */
  attestations: number;
  /** Number of attestations required to finalise */
  required: number;
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
   * @param txBytes - Complete signed transaction (136-byte with full Ed25519 signature)
   * @returns Submission response with acceptance status and hash
   */
  async send(txBytes: Uint8Array): Promise<SendResponse> {
    // Parse the fields from the transaction bytes and send as JSON
    // Format: from(32) + to(32) + amount(4) + nonce(4) + signature(64) = 136 bytes
    const from = txBytes.slice(0, 32);
    const to = txBytes.slice(32, 64);
    const view = new DataView(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength);
    const amount = view.getUint32(64, true);
    const nonce = view.getUint32(68, true);
    const signature = txBytes.slice(72, 136);

    const body = {
      from: toHex(from),
      to: toHex(to),
      amount,
      nonce,
      signature: toHex(signature),
    };

    const res = await fetch(`${this.rpc}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      body: JSON.stringify({ recipient: hex }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Faucet request failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<FaucetResponse>;
  }

  /**
   * Initiate a bridge-in: notify Zero that tokens were locked on an external chain.
   *
   * @param req - Bridge-in request with source chain, token, tx hash, and recipient
   * @returns Bridge-in response with bridge ID, status, and Z amount
   */
  async bridgeIn(req: BridgeInRequest): Promise<BridgeInResponse> {
    const res = await fetch(`${this.rpc}/api/bridge/in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bridge-in request failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<BridgeInResponse>;
  }

  /**
   * Initiate a bridge-out: withdraw Z back to an external chain.
   *
   * @param req - Bridge-out request with destination chain, token, address, amount, and signature
   * @returns Bridge-out response with bridge ID and status
   */
  async bridgeOut(req: BridgeOutRequest): Promise<BridgeOutResponse> {
    const res = await fetch(`${this.rpc}/api/bridge/out`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bridge-out request failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<BridgeOutResponse>;
  }

  /**
   * Get the status of a bridge operation.
   *
   * @param bridgeId - Unique bridge operation identifier
   * @returns Bridge status with direction, attestations, and current state
   */
  async bridgeStatus(bridgeId: string): Promise<BridgeStatusResponse> {
    const res = await fetch(`${this.rpc}/api/bridge/status/${bridgeId}`);
    if (!res.ok) {
      throw new Error(`Bridge status request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<BridgeStatusResponse>;
  }
}
