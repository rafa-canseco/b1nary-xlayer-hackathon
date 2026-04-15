"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Position } from "@/lib/api";
import { fmtUsd, fmtAsset, fmtYieldUsd, buildCalendarUrl } from "@/lib/utils";
import { CHAIN } from "@/lib/contracts";
import { getAssetConfig } from "@/lib/assets";
import { getPositionExpiryPrice, getPositionStrike } from "@/lib/positionMath";
import { formatApr } from "@/lib/yield";
import type { AaveRates } from "@/hooks/useAaveRates";
import { YieldExplainer } from "./yield/YieldExplainer";

import { ExpiryCountdown } from "./ExpiryCountdown";
import type { YieldMetric } from "./YieldToggle";

const BASE_EXPLORER = CHAIN.blockExplorers?.default.url ?? null;

function explorerTxUrl(txHash: string): string | null {
  return BASE_EXPLORER ? `${BASE_EXPLORER}/tx/${txHash}` : null;
}

function positionTxUrl(
  position: Position,
  kind: "open" | "settlement" | "delivery",
): string | null {
  if (kind === "open") {
    return position.tx_url ?? explorerTxUrl(position.tx_hash);
  }
  if (kind === "settlement") {
    return position.settlement_tx_url ??
      (position.settlement_tx_hash
        ? explorerTxUrl(position.settlement_tx_hash)
        : null);
  }
  return position.delivery_tx_url ??
    (position.delivery_tx_hash
      ? explorerTxUrl(position.delivery_tx_hash)
      : null);
}

interface YieldInfo {
  asset: string;
  deposited_at: string;
  is_active: boolean;
  estimated_yield: number;
}

interface Props {
  position: Position;
  onSettled?: () => void;
  spot?: number;
  renderExtra?: (position: Position, strike: number) => ReactNode;
  /** Base path for Earn links, e.g. "/earn/eth" */
  earnBase?: string;
  /** When true, shows a "Confirming..." badge for optimistic positions */
  optimistic?: boolean;
  /** Which yield metric to display — defaults to "apr" */
  yieldMetric?: YieldMetric;
  /** Asset symbol for display, e.g. "ETH", "cbBTC" */
  assetSymbol?: string;
  /** Asset slug for collateral logic, e.g. "eth", "btc" */
  assetSlug?: string;
  /** Yield position data keyed by vault_id */
  yieldByVault?: Map<number, YieldInfo>;
  /** Live Aave APR rates per asset */
  aaveRates?: AaveRates;
}

export function PositionCard({ position, onSettled, spot, renderExtra, earnBase = "/earn/eth", optimistic, yieldMetric = "apr", assetSymbol = "ETH", assetSlug = "eth", yieldByVault, aaveRates }: Props) {
  const isBuy = position.is_put;
  const isActive = !position.is_settled;

  const strike = getPositionStrike(position);

  // Collateral: puts = USDC (6 dec), calls = wrapped asset (varies)
  const config = getAssetConfig(assetSlug);
  const callDec = 10 ** (config?.collateralDecimals ?? 18);
  const committedUsd = isBuy
    ? position.collateral / 1e6
    : (position.collateral / callDec) * strike;
  const committedDisplay = isBuy
    ? `$${(position.collateral / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${fmtAsset(position.collateral / callDec)} ${assetSymbol}`;

  // Premium in LUSD base units (6 decimals)
  const premiumUsd = Number(position.net_premium) / 1e6;
  const returnPct = committedUsd > 0 ? (premiumUsd / committedUsd) * 100 : 0;

  // oToken amount (8 decimals)
  const ethAmount = position.amount / 1e8;
  const ethAmountDisplay = fmtAsset(ethAmount);

  // Expiry: total duration from indexed_at to expiry
  const indexedTime = new Date(position.indexed_at).getTime();
  const expiryTime = position.expiry * 1000;
  const totalDays = Math.max(1, Math.floor((expiryTime - indexedTime) / 86_400_000));

  // Days remaining: use UTC calendar date parts so the result matches the duration
  // selector (which uses parseLocalDate on expiry_date). position.expiry is midnight
  // UTC on the expiry date; converting via getUTC* then creating a local Date avoids
  // the off-by-one that occurs in negative UTC offsets.
  const expiryUTCDate = new Date(expiryTime);
  const expiryLocalMidnight = new Date(
    expiryUTCDate.getUTCFullYear(),
    expiryUTCDate.getUTCMonth(),
    expiryUTCDate.getUTCDate()
  );
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const expiryDays = Math.max(0, Math.ceil((expiryLocalMidnight.getTime() - todayMidnight.getTime()) / 86_400_000));

  // APR: annualize the return over the position duration
  const apr = committedUsd > 0 ? (premiumUsd / committedUsd) * (365 / totalDays) * 100 : 0;

  // Yield metric display
  const yieldValue = yieldMetric === "apr" ? apr : returnPct;
  const yieldLabel = yieldMetric === "apr" ? "APR" : "ROI";

  // Settled state
  const isSettled = position.is_settled;
  const isItm = position.is_itm ?? false;
  const expiryPrice = getPositionExpiryPrice(position);
  const expiryPriceDisplay = expiryPrice != null
    ? `$${expiryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : null;

  // Cost basis for ITM assigned positions
  // Put assigned: user bought asset at strike - premium per unit
  // Call assigned: user sold asset at strike + premium per unit
  const premiumPerEth = ethAmount > 0 ? premiumUsd / ethAmount : 0;
  const costBasis = isBuy ? strike - premiumPerEth : strike + premiumPerEth;

  // Unrealized gain for ITM: compare current spot to cost basis
  const unrealizedPerEth = spot != null
    ? isBuy
      ? spot - costBasis   // bought asset: gain if spot > cost basis
      : costBasis - spot   // sold asset: gain if cost basis > spot
    : null;
  const unrealizedPct = unrealizedPerEth != null && costBasis > 0
    ? (unrealizedPerEth / costBasis) * 100
    : null;
  const unrealizedTotal = unrealizedPerEth != null ? unrealizedPerEth * ethAmount : null;

  // CTA link helpers
  const nextSide = isBuy ? "sell" : "buy";
  const sameSide = isBuy ? "buy" : "sell";
  const ctaEarnHref = (side: string, amount?: number) =>
    amount ? `${earnBase}?side=${side}&amount=${amount}` : `${earnBase}?side=${side}`;

  // Aave yield tracking for this position (from backend)
  const yieldInfo = yieldByVault?.get(position.vault_id);
  const collateralAsset = isBuy ? "usdc" : assetSlug;
  const aaveApr = aaveRates?.[collateralAsset] ?? 0;
  const yieldDays = yieldInfo
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(yieldInfo.deposited_at).getTime()) /
            86_400_000,
        ),
      )
    : null;
  // estimated_yield is in native asset units from the backend (real contract data)
  const estYieldUsd = yieldInfo
    ? yieldInfo.estimated_yield * (collateralAsset === "usdc" ? 1 : (spot ?? 0))
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* ── ACTIVE POSITION ── */}
      {isActive && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Buy" : "Sell"} {assetSymbol} at <span className="font-mono">${strike.toLocaleString()}</span>/{assetSymbol}
            </p>
            {optimistic && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Confirming...
              </span>
            )}
          </div>

          {/* Countdown — prominent */}
          <p className="text-lg font-bold text-[var(--bone)]">
            <ExpiryCountdown expiryTimestamp={position.expiry} />
          </p>

          {/* Premium earned — accent + mono */}
          <p className="text-base font-bold font-mono text-[var(--accent)]">
            ${fmtUsd(premiumUsd)} earned
            <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">
              {yieldValue < 10 ? yieldValue.toFixed(1) : Math.round(yieldValue)}% {yieldLabel}
            </span>
          </p>

          {/* Outcome text */}
          {spot != null && (() => {
            const isItmNow = isBuy ? spot < strike : spot > strike;
            const spotFmt = spot.toLocaleString(undefined, { maximumFractionDigits: 0 });
            return (
              <p className="text-sm font-medium text-[var(--text)]">
                <span className="text-[var(--text-secondary)]">{assetSymbol} now <span className="font-mono">${spotFmt}</span> · </span>
                {isItmNow ? (
                  isBuy
                    ? <>currently buying {assetSymbol} at <span className="font-mono">${strike.toLocaleString()}</span> · <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(premiumUsd)}</span> earned</>
                    : <>currently selling {assetSymbol} at <span className="font-mono">${strike.toLocaleString()}</span> · <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(premiumUsd)}</span> earned</>
                ) : (
                  <>currently keeping {committedDisplay} + <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(premiumUsd)}</span> earned</>
                )}
              </p>
            );
          })()}

          <p className="text-xs text-[var(--text-secondary)]">
            Committed {committedDisplay}
          </p>

          {yieldInfo && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono">{formatApr(aaveApr)}</span> APR via Aave
              {estYieldUsd != null && estYieldUsd > 0 && (
                <span className="font-mono">
                  · ~${fmtYieldUsd(estYieldUsd)} accrued ({yieldDays}d)
                </span>
              )}
              <YieldExplainer />
            </p>
          )}

          <div className="flex items-center gap-4">
            {position.tx_hash && (() => {
              const url = positionTxUrl(position, "open");
              return url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] hover:underline">
                  Open tx
                </a>
              ) : null;
            })()}
            <a
              href={buildCalendarUrl(position, assetSymbol, assetSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            >
              📅 Add to calendar
            </a>
          </div>
        </>
      )}

      {/* ── SETTLED: OTM — No trade ── */}
      {isSettled && !isItm && (
        <div className="space-y-3">
          {/* Badge */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Buy" : "Sell"} {assetSymbol} at <span className="font-mono">${strike.toLocaleString()}</span>/{assetSymbol}
            </p>
            <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              Earned
            </span>
          </div>

          {/* Two clear lines */}
          <p className="text-sm text-[var(--text)]">
            Your price wasn&apos;t reached. No trade.
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Committed {committedDisplay} → Returned {committedDisplay} +{" "}
            <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(premiumUsd)} earned</span>
          </p>

          <p className="text-xs text-[var(--text-secondary)]">
            {expiryPriceDisplay && <>Maturity price: {expiryPriceDisplay}/{assetSymbol} · </>}
            {returnPct.toFixed(1)}% in {totalDays}d · {yieldValue < 10 ? yieldValue.toFixed(1) : Math.round(yieldValue)}% {yieldLabel}
          </p>

          <div className="flex gap-3 text-xs">
            {position.tx_hash && (() => {
              const url = positionTxUrl(position, "open");
              return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Open tx</a> : null;
            })()}
            {position.settlement_tx_hash && (() => {
              const url = positionTxUrl(position, "settlement");
              return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Settle tx</a> : null;
            })()}
          </div>

          {/* CTA: Earn again */}
          <Link
            href={ctaEarnHref(sameSide, ethAmount)}
            className="block w-full text-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            Earn again
          </Link>
        </div>
      )}

      {/* ── SETTLED: ITM — Assigned ── */}
      {isSettled && isItm && (
        <div className="space-y-3">
          {/* Badge — positive framing */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--bone)]">
              {isBuy ? "Bought" : "Sold"} <span className="font-mono">{ethAmountDisplay}</span> {assetSymbol}
            </p>
            <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              Assigned
            </span>
          </div>

          {/* Cost basis */}
          <div className="space-y-1">
            <p className="text-sm text-[var(--text)]">
              {isBuy
                ? `You bought ${assetSymbol} at $${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : `You sold ${assetSymbol} at $${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Strike ${strike.toLocaleString()} {isBuy ? "−" : "+"} premium ${premiumPerEth.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{assetSymbol} = cost basis ${costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{assetSymbol}
            </p>
          </div>

          {/* Unrealized gain/loss — live with spot */}
          {unrealizedPerEth != null && spot != null && (
            <div className={`rounded-xl px-4 py-3 ${unrealizedPerEth >= 0 ? "bg-[var(--accent)]/10" : "bg-[var(--danger)]/10"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">
                  {isBuy ? "Unrealized gain" : "Realized gain"}
                </span>
                <span className={`text-base font-bold font-mono ${unrealizedPerEth >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                  {unrealizedPerEth >= 0 ? "+" : ""}${(unrealizedTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-[var(--text-secondary)]">
                  {assetSymbol} now: ${spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                {unrealizedPct != null && (
                <span className={`text-xs font-mono ${unrealizedPerEth >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                  {unrealizedPerEth >= 0 ? "+" : ""}{unrealizedPct.toFixed(1)}%/{assetSymbol}
                </span>
                )}
              </div>
            </div>
          )}

          {/* Premium kept */}
          <p className="text-sm text-[var(--text-secondary)]">
            + kept{" "}
            <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(premiumUsd)} in premium</span>
          </p>

          {expiryPriceDisplay && (
            <p className="text-xs text-[var(--text-secondary)]">
              Maturity price: {expiryPriceDisplay}/{assetSymbol}
            </p>
          )}

          <div className="flex gap-3 text-xs">
            {position.tx_hash && (() => {
              const url = positionTxUrl(position, "open");
              return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Open tx</a> : null;
            })()}
            {position.settlement_tx_hash && (() => {
              const url = positionTxUrl(position, "settlement");
              return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Settle tx</a> : null;
            })()}
            {position.delivery_tx_hash && (() => {
              const url = positionTxUrl(position, "delivery");
              return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Delivery tx</a> : null;
            })()}
          </div>

          {/* CTA: Next step */}
          <Link
            href={ctaEarnHref(nextSide, ethAmount)}
            className="block w-full text-center rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            {isBuy
              ? `Earn on your new ${assetSymbol}`
              : "Earn on your USD"}
          </Link>
        </div>
      )}

      {/* Extra visual slot (V2 sparklines) */}
      {renderExtra?.(position, strike)}

    </div>
  );
}
