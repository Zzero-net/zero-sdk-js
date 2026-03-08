# @zero-network/sdk

JavaScript/TypeScript SDK for the [Zero Network](https://zzero.net) — stablecoin microtransactions for AI agents.

## Install

```bash
npm install @zero-network/sdk
```

## Quick Start

```ts
import { Wallet } from "@zero-network/sdk";

// Create a new wallet
const wallet = Wallet.create();
console.log("Address:", wallet.address);
console.log("Seed (backup):", wallet.seedHex);

// Fund from testnet faucet
await wallet.faucet();

// Check balance
const bal = await wallet.balance();
console.log("Balance:", bal.balance / 100, "Z");

// Send Z
const result = await wallet.send("recipient_pubkey_hex", 1.5);
console.log("TX hash:", result.hash);
```

## Restore a Wallet

```ts
// From seed
const wallet = Wallet.fromSeed("your_64_char_hex_seed");

// From environment variable (Node.js)
// Set ZERO_KEY=your_64_char_hex_seed
const wallet = Wallet.fromEnv();
```

## Low-Level Client

```ts
import { ZeroClient } from "@zero-network/sdk";

const client = new ZeroClient(); // defaults to https://rpc.zzero.net
const status = await client.status();
const account = await client.account("pubkey_hex");
const history = await client.history("pubkey_hex", 10);
```

## Build Transactions Manually

```ts
import { buildTransfer, signTransfer, parseTransfer } from "@zero-network/sdk";

const unsigned = buildTransfer(fromPubkey, toPubkey, amountUnits, nonce);
const signed = signTransfer(unsigned, secretKey); // 100-byte tx
const parsed = parseTransfer(signed);
```

## x402 Auto-Pay

```ts
import { Wallet, x402Fetch } from "@zero-network/sdk";

const wallet = Wallet.fromEnv();
// If the server responds 402, the SDK pays automatically and retries
const response = await x402Fetch("https://api.example.com/premium", wallet);
```

## Express.js Paywall

```ts
import express from "express";
import { ZeroPaywall } from "@zero-network/sdk";

const app = express();
const paywall = new ZeroPaywall({ address: "your_pubkey_hex" });

app.get("/premium", paywall.gate(0.05), (req, res) => {
  res.json({ data: "premium content" });
});
```

## Constants

```ts
import { UNITS_PER_Z, FEE_Z, MAX_TRANSFER_Z } from "@zero-network/sdk";
// 1 Z = 100 units = $0.01 USD
// Fee: 0.01 Z (1 unit)
// Max transfer: 25 Z (2500 units)
```

## Network

| Parameter | Value |
|-----------|-------|
| 1 Z | $0.01 USD |
| 1 Z | 100 internal units |
| Transaction fee | 0.01 Z (1 unit) |
| Max transfer | 25 Z (2500 units) |
| Account creation | 1.00 Z on first receive |
| Signature | Ed25519 (tweetnacl) |
| Transaction size | 100 bytes |

## License

MIT
