"use client";

import { useState } from "react";
import Link from "next/link";
import type { Position } from "@/lib/api";
import { fmtUsd, fmtYieldUsd, buildCalendarUrl } from "@/lib/utils";
import { CHAIN } from "@/lib/contracts";
import { solanaTxUrl } from "@/lib/solana";
import { getAssetConfig } from "@/lib/assets";
import { getPositionStrike } from "@/lib/positionMath";
import { YieldExplainer } from "./yield/YieldExplainer";
import { ExpiryCountdown } from "./ExpiryCountdown";
import type { YieldMetric } from "./YieldToggle";

const EXPLORER = CHAIN.blockExplorers?.default.url ?? null;

function explorerTxUrl(txHash: string, slug: string): string | null {
  if (slug === "sol") {
    return solanaTxUrl(txHash);
  }
  return EXPLORER ? `${EXPLORER}/tx/${txHash}` : null;
}

function positionOpenTxUrl(position: Position, slug: string): string | null {
  return position.tx_url ?? explorerTxUrl(position.tx_hash, slug);
}

interface YieldInfo {
  asset: string;
  deposited_at: string;
  is_active: boolean;
  estimated_yield: number;
}

interface Props {
  positions: Position[];
  spot?: number;
  earnBase?: string;
  optimistic?: boolean;
  yieldMetric?: YieldMetric;
  assetSymbol?: string;
  assetSlug?: string;
  yieldByVault?: Map<number, YieldInfo>;
}

export function RangePositionCard({
  positions,
  spot,
  earnBase = "/earn/eth",
  optimistic,
  yieldMetric = "apr",
  assetSymbol = "ETH",
  assetSlug = "eth",
  yieldByVault,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const putLeg = positions.find((p) => p.is_put);
  const callLeg = positions.find((p) => !p.is_put);
  if (!putLeg || !callLeg) return null;

  const putStrike = getPositionStrike(putLeg);
  const callStrike = getPositionStrike(callLeg);
  const isActive = !putLeg.is_settled && !callLeg.is_settled;
  const isSettled = putLeg.is_settled && callLeg.is_settled;

  // Combined premium
  const putPremium = Number(putLeg.net_premium) / 1e6;
  const callPremium = Number(callLeg.net_premium) / 1e6;
  const totalPremium = putPremium + callPremium;

  // Combined committed capital (both sides in USD)
  const callDec = 10 ** (getAssetConfig(assetSlug)?.collateralDecimals ?? 18);
  const putCommittedUsd = putLeg.collateral / 1e6;
  const callCommittedUsd = (callLeg.collateral / callDec) * callStrike;
  const totalCommittedUsd = putCommittedUsd + callCommittedUsd;

  // ROI / APR
  const indexedTime = new Date(putLeg.indexed_at).getTime();
  const expiryTime = putLeg.expiry * 1000;
  const totalDays = Math.max(
    1,
    Math.floor((expiryTime - indexedTime) / 86_400_000),
  );
  const returnPct =
    totalCommittedUsd > 0
      ? (totalPremium / totalCommittedUsd) * 100
      : 0;
  const apr =
    totalCommittedUsd > 0
      ? (totalPremium / totalCommittedUsd) * (365 / totalDays) * 100
      : 0;
  const yieldValue = yieldMetric === "apr" ? apr : returnPct;
  const yieldLabel = yieldMetric === "apr" ? "APR" : "ROI";

  // Settled state
  const putItm = putLeg.is_itm ?? false;
  const callItm = callLeg.is_itm ?? false;

  // Distance to range bounds
  const putDistPct = spot
    ? ((putStrike - spot) / spot) * 100
    : null;
  const callDistPct = spot
    ? ((callStrike - spot) / spot) * 100
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
      {/* ── ACTIVE RANGE ── */}
      {isActive && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                Range
              </span>
              <p className="text-base font-semibold text-[var(--bone)]">
                <span className="font-mono">
                  ${putStrike.toLocaleString()}
                </span>
                {" — "}
                <span className="font-mono">
                  ${callStrike.toLocaleString()}
                </span>
              </p>
            </div>
            {optimistic && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Confirming...
              </span>
            )}
          </div>

          <p className="text-lg font-bold text-[var(--bone)]">
            <ExpiryCountdown expiryTimestamp={putLeg.expiry} />
          </p>

          <p className="text-base font-bold font-mono text-[var(--accent)]">
            ${fmtUsd(totalPremium)} earned
            <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">
              {yieldValue < 10
                ? yieldValue.toFixed(1)
                : Math.round(yieldValue)}
              % {yieldLabel}
            </span>
          </p>

          {/* Range bar */}
          {spot != null && (
            <div className="space-y-1">
              <div className="relative h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                <RangeBar
                  putStrike={putStrike}
                  callStrike={callStrike}
                  spot={spot}
                />
              </div>
              {(() => {
                const putItmNow = spot < putStrike;
                const callItmNow = spot > callStrike;
                const putCommittedDisplay = `$${putLeg.collateral / 1e6 > 0 ? (putLeg.collateral / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
                const spotFmt = spot.toLocaleString(undefined, { maximumFractionDigits: 0 });
                return (
                  <p className="text-sm font-medium text-[var(--text)] mt-1">
                    <span className="text-[var(--text-secondary)]">{assetSymbol} now <span className="font-mono">${spotFmt}</span> · </span>
                    {callItmNow ? (
                      <>currently selling {assetSymbol} at <span className="font-mono">${callStrike.toLocaleString()}</span> · <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(totalPremium)}</span> earned</>
                    ) : putItmNow ? (
                      <>currently buying {assetSymbol} at <span className="font-mono">${putStrike.toLocaleString()}</span> · <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(totalPremium)}</span> earned</>
                    ) : (
                      <>currently keeping {putCommittedDisplay} + <span className="text-[var(--accent)] font-semibold font-mono">${fmtUsd(totalPremium)}</span> earned</>
                    )}
                  </p>
                );
              })()}
            </div>
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            Committed ${totalCommittedUsd.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>

          {(() => {
            const putYp = yieldByVault?.get(putLeg.vault_id);
            const callYp = yieldByVault?.get(callLeg.vault_id);
            if (!putYp && !callYp) return null;
            const yp = putYp ?? callYp!;
            const days = Math.max(1, Math.round((Date.now() - new Date(yp.deposited_at).getTime()) / 86_400_000));
            const putYieldUsd = (putYp?.estimated_yield ?? 0);
            const callYieldUsd = (callYp?.estimated_yield ?? 0) * (spot ?? 0);
            const totalEstYield = putYieldUsd + callYieldUsd;
            return (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Earning Aave yield
                {totalEstYield > 0 && (
                  <span className="font-mono">
                    · ~${fmtYieldUsd(totalEstYield)} accrued ({days}d)
                  </span>
                )}
                <YieldExplainer />
              </p>
            );
          })()}

          {/* Expandable leg details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>

          {expanded && (
            <div className="space-y-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">
              <div className="flex justify-between">
                <span>
                  Lower (buy at ${putStrike.toLocaleString()})
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(putPremium)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Upper (sell at ${callStrike.toLocaleString()})
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(callPremium)}
                </span>
              </div>
              {(putLeg.tx_hash || callLeg.tx_hash) && (
                <div className="flex gap-3">
                  {putLeg.tx_hash && positionOpenTxUrl(putLeg, assetSlug) && (
                    <a
                      href={positionOpenTxUrl(putLeg, assetSlug)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Lower tx
                    </a>
                  )}
                  {callLeg.tx_hash && positionOpenTxUrl(callLeg, assetSlug) && (
                    <a
                      href={positionOpenTxUrl(callLeg, assetSlug)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Upper tx
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <a
            href={buildCalendarUrl(
              putLeg,
              assetSymbol,
              assetSlug,
              `b1nary: ${assetSymbol} range expiry ($${putStrike.toLocaleString("en-US")}–$${callStrike.toLocaleString("en-US")})`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            📅 Add to calendar
          </a>
        </>
      )}

      {/* ── SETTLED RANGE ── */}
      {isSettled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                Range
              </span>
              <p className="text-base font-semibold text-[var(--bone)]">
                <span className="font-mono">
                  ${putStrike.toLocaleString()}
                </span>
                {" — "}
                <span className="font-mono">
                  ${callStrike.toLocaleString()}
                </span>
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                !putItm && !callItm
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-amber-400 bg-amber-400/10"
              }`}
            >
              {!putItm && !callItm
                ? "Earned"
                : "Assigned"}
            </span>
          </div>

          {/* Outcome message */}
          {!putItm && !callItm && (
            <p className="text-sm text-[var(--text)]">
              Stayed in range. Everything returned +{" "}
              <span className="text-[var(--accent)] font-semibold font-mono">
                ${fmtUsd(totalPremium)} earned
              </span>
            </p>
          )}
          {putItm && (
            <p className="text-sm text-[var(--text)]">
              Price dropped below range. You bought {assetSymbol} at{" "}
              <span className="font-mono">
                ${putStrike.toLocaleString()}
              </span>
            </p>
          )}
          {callItm && (
            <p className="text-sm text-[var(--text)]">
              Price rose above range. You sold {assetSymbol} at{" "}
              <span className="font-mono">
                ${callStrike.toLocaleString()}
              </span>
            </p>
          )}

          <p className="text-xs text-[var(--text-secondary)]">
            {returnPct.toFixed(1)}% in {totalDays}d ·{" "}
            {yieldValue < 10
              ? yieldValue.toFixed(1)
              : Math.round(yieldValue)}
            % {yieldLabel}
          </p>

          {/* Expandable leg details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>

          {expanded && (
            <div className="space-y-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">
              <div className="flex justify-between">
                <span>
                  Lower: {putItm ? "Assigned" : "OTM"} — buy at $
                  {putStrike.toLocaleString()}
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(putPremium)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Upper: {callItm ? "Assigned" : "OTM"} — sell at $
                  {callStrike.toLocaleString()}
                </span>
                <span className="font-mono text-[var(--accent)]">
                  ${fmtUsd(callPremium)}
                </span>
              </div>
              {(positionOpenTxUrl(putLeg, assetSlug) || positionOpenTxUrl(callLeg, assetSlug)) && (
                <div className="flex gap-3">
                  {positionOpenTxUrl(putLeg, assetSlug) && (
                    <a
                      href={positionOpenTxUrl(putLeg, assetSlug)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Lower tx
                    </a>
                  )}
                  {positionOpenTxUrl(callLeg, assetSlug) && (
                    <a
                      href={positionOpenTxUrl(callLeg, assetSlug)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Upper tx
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <Link
            href={`${earnBase}?side=range`}
            className="block w-full text-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            Set another range
          </Link>
        </div>
      )}
    </div>
  );
}

function RangeBar({
  putStrike,
  callStrike,
  spot,
}: {
  putStrike: number;
  callStrike: number;
  spot: number;
}) {
  const margin = (callStrike - putStrike) * 0.3;
  const min = putStrike - margin;
  const max = callStrike + margin;
  const range = max - min || 1;
  const leftPct = ((putStrike - min) / range) * 100;
  const rightPct = ((callStrike - min) / range) * 100;
  const spotPct = Math.max(0, Math.min(100, ((spot - min) / range) * 100));
  const inRange = spot >= putStrike && spot <= callStrike;

  return (
    <>
      {/* Range zone */}
      <div
        className="absolute top-0 bottom-0 bg-[var(--accent)]/20 rounded-full"
        style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
      />
      {/* Spot marker */}
      <div
        className={`absolute top-[-2px] w-1.5 h-[calc(100%+4px)] rounded-full ${
          inRange ? "bg-[var(--accent)]" : "bg-[var(--text-secondary)]"
        }`}
        style={{ left: `${spotPct}%`, transform: "translateX(-50%)" }}
      />
    </>
  );
}
