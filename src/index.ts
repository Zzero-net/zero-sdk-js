// Core classes
export { Wallet } from "./wallet.js";
export { ZeroClient } from "./client.js";

// Transaction utilities
export {
  buildTransfer,
  signTransfer,
  parseTransfer,
  toHex,
  fromHex,
} from "./transaction.js";
export type { ParsedTransfer } from "./transaction.js";

// x402 protocol support
export { x402Fetch, ZeroPaywall } from "./x402.js";
export type { X402FetchOptions, PaywallOptions } from "./x402.js";

// Client types
export type {
  NetworkStatus,
  BalanceResponse,
  AccountState,
  TransactionRecord,
  SendResponse,
  FaucetResponse,
  BridgeInRequest,
  BridgeInResponse,
  BridgeOutRequest,
  BridgeOutResponse,
  BridgeStatusResponse,
} from "./client.js";

// Network constants
export {
  DEFAULT_RPC,
  DEFAULT_FAUCET,
  UNITS_PER_Z,
  USD_PER_Z,
  FEE_UNITS,
  FEE_Z,
  MAX_TRANSFER_UNITS,
  MAX_TRANSFER_Z,
  ACCOUNT_CREATION_UNITS,
  ACCOUNT_CREATION_Z,
  TX_SIZE,
  PUBKEY_SIZE,
  SIG_SIZE,
} from "./constants.js";
