import type { AaveRates } from "@/hooks/useAaveRates";

const ASSET_DECIMALS: Record<string, number> = {
  usdc: 6,
  eth: 18,
  btc: 8,
};

export function formatApr(rate: number): string {
  if (rate === 0) return "0%";
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Estimate accrued yield in human-readable asset units.
 * Simple linear approximation — close enough for display.
 */
export function estimateYield(
  collateralRaw: number,
  asset: string,
  days: number,
  apr: number,
): number {
  const decimals = ASSET_DECIMALS[asset] ?? 18;
  const human = collateralRaw / 10 ** decimals;
  return human * apr * (days / 365);
}

/**
 * Estimate yield in USD. For USDC amount = USD.
 * For others, multiply by spot price.
 */
export function estimateYieldUsd(
  collateralRaw: number,
  asset: string,
  days: number,
  apr: number,
  spot?: number,
): number {
  const yieldAmount = estimateYield(collateralRaw, asset, days, apr);
  if (asset === "usdc") return yieldAmount;
  return yieldAmount * (spot ?? 0);
}
