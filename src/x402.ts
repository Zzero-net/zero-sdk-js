import type { Wallet } from "./wallet.js";
import { UNITS_PER_Z } from "./constants.js";

/**
 * Options for x402Fetch, extending standard RequestInit.
 */
export interface X402FetchOptions extends RequestInit {
  /** Maximum amount in Z the wallet is willing to pay (default: 25) */
  maxPayZ?: number;
}

/**
 * Payment details extracted from a 402 response.
 */
interface PaymentRequired {
  /** Recipient address */
  address: string;
  /** Amount in Z */
  amountZ: number;
}

/**
 * Auto-paying fetch wrapper implementing the x402 protocol.
 *
 * Makes a request to the given URL. If the server responds with HTTP 402
 * (Payment Required), automatically pays the requested amount from the
 * wallet and retries the request with a payment receipt.
 *
 * The 402 response must include headers:
 * - `X-Payment-Address`: recipient public key (hex)
 * - `X-Payment-Amount`: amount in internal units
 *
 * After payment, the retry includes:
 * - `X-Payment-Hash`: transaction hash
 * - `X-Payment-Address`: payer's public key
 *
 * @param url - The URL to fetch
 * @param wallet - Wallet to pay from if 402 is received
 * @param options - Fetch options plus optional maxPayZ limit
 * @returns The final response (either the original if not 402, or the retry after payment)
 *
 * @example
 * ```ts
 * const wallet = Wallet.create();
 * const response = await x402Fetch("https://api.example.com/premium", wallet);
 * const data = await response.json();
 * ```
 */
export async function x402Fetch(
  url: string,
  wallet: Wallet,
  options: X402FetchOptions = {}
): Promise<Response> {
  const { maxPayZ = 25, ...fetchOptions } = options;

  // Initial request
  const res = await fetch(url, fetchOptions);

  // If not 402, return as-is
  if (res.status !== 402) {
    return res;
  }

  // Extract payment details from 402 response
  const payment = parsePaymentRequired(res);

  // Validate amount
  if (payment.amountZ > maxPayZ) {
    throw new Error(
      `Payment of ${payment.amountZ} Z exceeds maxPayZ limit of ${maxPayZ} Z`
    );
  }

  // Make payment
  const sendResult = await wallet.send(payment.address, payment.amountZ);
  if (!sendResult.ok) {
    throw new Error(`Payment failed: ${sendResult.error || "unknown error"}`);
  }

  // Retry with payment proof
  const retryHeaders = new Headers(fetchOptions.headers || {});
  retryHeaders.set("X-Payment-Hash", sendResult.hash || "");
  retryHeaders.set("X-Payment-Address", wallet.address);

  return fetch(url, {
    ...fetchOptions,
    headers: retryHeaders,
  });
}

/**
 * Parse payment requirements from a 402 response.
 */
function parsePaymentRequired(res: Response): PaymentRequired {
  const address = res.headers.get("X-Payment-Address");
  const amountStr = res.headers.get("X-Payment-Amount");

  if (!address) {
    throw new Error("402 response missing X-Payment-Address header");
  }
  if (!amountStr) {
    throw new Error("402 response missing X-Payment-Amount header");
  }

  const amountUnits = parseInt(amountStr, 10);
  if (isNaN(amountUnits) || amountUnits <= 0) {
    throw new Error(`Invalid payment amount: ${amountStr}`);
  }

  return {
    address,
    amountZ: amountUnits / UNITS_PER_Z,
  };
}

/**
 * Options for the ZeroPaywall middleware.
 */
export interface PaywallOptions {
  /** RPC endpoint to verify payments (optional, for future on-chain verification) */
  rpc?: string;
  /** Wallet address to receive payments */
  address: string;
}

/**
 * Minimal request type compatible with Express.js.
 */
interface PaywallRequest {
  headers: Record<string, string | string[] | undefined> | { get(name: string): string | null | undefined };
}

/**
 * Minimal response type compatible with Express.js.
 */
interface PaywallResponse {
  status(code: number): PaywallResponse;
  set(name: string, value: string): PaywallResponse;
  json(body: unknown): void;
}

/**
 * Express.js-compatible paywall middleware for the Zero Network.
 *
 * Checks incoming requests for valid payment proof headers.
 * If no payment proof is present, responds with HTTP 402 and the required
 * payment headers.
 *
 * @example
 * ```ts
 * import express from "express";
 * import { ZeroPaywall } from "@zero-network/sdk";
 *
 * const app = express();
 * const paywall = new ZeroPaywall({ address: "your_pubkey_hex" });
 *
 * app.get("/premium", paywall.gate(0.05), (req, res) => {
 *   res.json({ data: "premium content" });
 * });
 * ```
 */
export class ZeroPaywall {
  /** Wallet address to receive payments */
  readonly address: string;
  /** RPC endpoint for optional payment verification */
  readonly rpc: string | undefined;

  /**
   * Create a new ZeroPaywall.
   *
   * @param options - Paywall configuration
   */
  constructor(options: PaywallOptions) {
    this.address = options.address;
    this.rpc = options.rpc;
  }

  /**
   * Create an Express.js middleware that requires payment of the specified amount.
   *
   * If the request includes valid `X-Payment-Hash` and `X-Payment-Address` headers,
   * the request is allowed through. Otherwise, a 402 response is sent with the
   * required payment details.
   *
   * @param amountZ - Required payment amount in Z
   * @returns Express.js middleware function
   */
  gate(amountZ: number): (req: PaywallRequest, res: PaywallResponse, next: () => void) => void {
    const amountUnits = Math.round(amountZ * UNITS_PER_Z);
    const address = this.address;

    return (req: PaywallRequest, res: PaywallResponse, next: () => void): void => {
      // Check for payment proof
      const paymentHash = getHeader(req, "x-payment-hash");
      const paymentAddress = getHeader(req, "x-payment-address");

      if (paymentHash && paymentAddress) {
        // Payment proof present — allow through
        // In a production implementation, you would verify the payment
        // on-chain here before calling next()
        next();
        return;
      }

      // No payment — respond with 402
      res
        .status(402)
        .set("X-Payment-Address", address)
        .set("X-Payment-Amount", String(amountUnits))
        .json({
          error: "Payment Required",
          address,
          amount: amountUnits,
          amountZ,
          currency: "Z",
        });
    };
  }
}

/**
 * Helper to extract a header value from an Express-like request.
 */
function getHeader(req: PaywallRequest, name: string): string | undefined {
  if (typeof (req.headers as any).get === "function") {
    return (req.headers as any).get(name) ?? undefined;
  }
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
