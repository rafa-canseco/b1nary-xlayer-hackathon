import { Connection, PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
export const SOLANA_USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ?? "";
export const SOLANA_CHAIN =
  process.env.NEXT_PUBLIC_SOLANA_CHAIN ?? "solana:devnet";

/** Native SOL mint address — used as wSOL when wrapped into SPL token */
export const SOLANA_WSOL_MINT =
  "So11111111111111111111111111111111111111112";

/**
 * Keep native SOL available for rent/account state when wrapping to wSOL.
 * Gas is sponsored, but wrapping can still require rent-exempt lamports.
 */
export const SOLANA_NATIVE_RESERVE_LAMPORTS = BigInt(15_000_000);

/** Block explorer for Solana transaction links */
export const SOLANA_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL ??
  "https://solscan.io";

export function solanaTxUrl(signature: string): string {
  const baseUrl = `${SOLANA_EXPLORER_URL.replace(/\/$/, "")}/tx/${signature}`;
  if (SOLANA_CHAIN.includes("devnet")) return `${baseUrl}?cluster=devnet`;
  if (SOLANA_CHAIN.includes("testnet")) return `${baseUrl}?cluster=testnet`;
  return baseUrl;
}

if (!SOLANA_RPC_URL) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_RPC_URL is not set. " +
      "Solana features will not work.",
  );
}

if (!SOLANA_USDC_MINT) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_USDC_MINT is not set. " +
      "Solana USDC balance will always show as zero.",
  );
}

export const solanaConnection = SOLANA_RPC_URL
  ? new Connection(SOLANA_RPC_URL)
  : null;

export function toPublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(
      `Invalid Solana public key for ${label}: "${value}"`,
    );
  }
}
