import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Position } from "@/lib/api"
import { getAssetConfig } from "@/lib/assets"
import { getPositionStrike } from "@/lib/positionMath"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtUsd(n: number): string {
  if (n < 100) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}

export function fmtYieldUsd(n: number): string {
  if (n === 0) return "0.00";
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 0.01) return n.toFixed(2);
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  return n.toFixed(Math.abs(magnitude) + 2);
}

export function getNextMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntil = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntil);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function fmtAsset(n: number): string {
  if (n === 0) return "0";
  if (n >= 0.01) return n.toFixed(2);
  const magnitude = Math.floor(Math.log10(n));
  return n.toFixed(Math.abs(magnitude) + 1);
}

export function floorTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

export function buildCalendarUrl(
  position: Position,
  assetSymbol: string,
  assetSlug: string,
  titleOverride?: string,
): string {
  const strike = getPositionStrike(position);
  const side = position.is_put ? "put" : "call";
  const strikeFmt = strike.toLocaleString("en-US");
  const title = titleOverride ?? `b1nary: ${assetSymbol} $${strikeFmt} ${side} expiry`;

  // Settlement runs at 08:00 UTC; position.expiry is midnight UTC on that date
  const d = new Date(position.expiry * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const dates = `${day}T080000Z/${day}T090000Z`;

  const callDec = 10 ** (getAssetConfig(assetSlug)?.collateralDecimals ?? 18);
  const premiumUsd = Number(position.net_premium) / 1e6;
  const committedDisplay = position.is_put
    ? `$${(position.collateral / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `${(position.collateral / callDec).toFixed(4)} ${assetSymbol}`;

  const details = `Strike: $${strikeFmt} | Committed: ${committedDisplay} | Premium earned: $${premiumUsd.toFixed(2)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildTweetUrl(
  apr: number,
  assetSymbol: string,
  mode: "buy" | "sell" | "range",
): string {
  const rounded = Math.round(apr);
  let text: string;
  if (mode === "buy") {
    text = `Set the price I'd buy ${assetSymbol} at. ${rounded}% APR on my USDC.\n@b1naryprotocol b1nary.app`;
  } else if (mode === "sell") {
    text = `Set the price I'd sell ${assetSymbol} at. ${rounded}% APR on my ${assetSymbol}.\n@b1naryprotocol b1nary.app`;
  } else {
    const article = /^[aeiouAEIOU]/.test(assetSymbol) ? "an" : "a";
    text = `Got paid to set ${article} ${assetSymbol} range. ${rounded}% APR on my USDC.\n@b1naryprotocol b1nary.app`;
  }
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
