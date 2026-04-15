import type { Position } from "@/lib/api";

function finiteNumber(value: unknown): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

export function normalizeUsdPrice(rawValue: unknown): number {
  const raw = finiteNumber(rawValue);
  if (raw == null || raw <= 0) return 0;

  const legacyEightDecimal = raw / 1e8;
  if (legacyEightDecimal >= 1) return legacyEightDecimal;

  if (raw >= 1 && raw < 1_000_000) return raw;

  return legacyEightDecimal;
}

export function getPositionStrike(position: Position): number {
  const normalized =
    finiteNumber(position.strike_usd) ?? finiteNumber(position.strike);
  if (normalized != null && normalized > 0) return normalized;
  return normalizeUsdPrice(position.strike_price);
}

export function getPositionExpiryPrice(position: Position): number | null {
  const normalized = finiteNumber(position.expiry_price_usd);
  if (normalized != null && normalized > 0) return normalized;
  if (position.expiry_price == null) return null;
  const price = normalizeUsdPrice(position.expiry_price);
  return price > 0 ? price : null;
}

export function getCallCollateralDecimals(position: Position): number {
  const decimals = finiteNumber((position as Position & {
    collateral_decimals?: number | string | null;
  }).collateral_decimals);
  return decimals != null && decimals >= 0 ? decimals : 18;
}
