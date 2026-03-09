/** Default RPC endpoint for the Zero Network */
export const DEFAULT_RPC = "https://rpc.zzero.net";

/** Default faucet endpoint (testnet) */
export const DEFAULT_FAUCET = "https://rpc.zzero.net";

/** 1 Z = 100 internal units */
export const UNITS_PER_Z = 100;

/** 1 Z = $0.01 USD */
export const USD_PER_Z = 0.01;

/** Transfer fee: 0.01 Z = 1 unit */
export const FEE_UNITS = 1;

/** Transfer fee in Z */
export const FEE_Z = 0.01;

/** Bridge-out fee: 0.5 Z = 50 units (covers EVM gas for vault release) */
export const BRIDGE_OUT_FEE_UNITS = 50;

/** Bridge-out fee in Z */
export const BRIDGE_OUT_FEE_Z = 0.5;

/** Maximum transfer amount: 25 Z = 2500 units */
export const MAX_TRANSFER_UNITS = 2500;

/** Maximum transfer amount in Z */
export const MAX_TRANSFER_Z = 25;

/** Account creation cost: 5.00 Z = 500 units (deducted on first receive) */
export const ACCOUNT_CREATION_UNITS = 500;

/** Account creation cost in Z */
export const ACCOUNT_CREATION_Z = 5.0;

/** Total transaction size in bytes (from[32] + to[32] + amount[4] + nonce[4] + signature[64]) */
export const TX_SIZE = 136;

/** Public key size in bytes (Ed25519) */
export const PUBKEY_SIZE = 32;

/** Signature size in the transaction (full Ed25519) */
export const SIG_SIZE = 64;

/** Amount field size in bytes (uint32 little-endian) */
export const AMOUNT_SIZE = 4;

/** Nonce field size in bytes (uint32 little-endian) */
export const NONCE_SIZE = 4;

/** Full Ed25519 signature size */
export const ED25519_SIG_SIZE = 64;

/** Ed25519 seed size */
export const ED25519_SEED_SIZE = 32;
