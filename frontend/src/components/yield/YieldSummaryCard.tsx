"use client";

import type { YieldAssetSummary } from "@/lib/api";
import { ASSETS } from "@/lib/assets";
import { fmtYieldUsd, getNextMonday, fmtAsset } from "@/lib/utils";
import { formatApr } from "@/lib/yield";
import { YieldExplainer } from "./YieldExplainer";

function assetLabel(slug: string): string {
  if (slug === "usdc") return "USDC";
  return ASSETS[slug]?.wrappedSymbol ?? slug.toUpperCase();
}

function toUsd(
  amount: number,
  asset: string,
  ethSpot: number | undefined,
  btcSpot: number | undefined,
): number {
  if (asset === "usdc") return amount;
  if (asset === "eth") return amount * (ethSpot ?? 0);
  if (asset === "btc") return amount * (btcSpot ?? 0);
  return 0;
}

interface Props {
  assets: YieldAssetSummary[];
  ethSpot: number | undefined;
  btcSpot: number | undefined;
  hasPositions: boolean;
  aaveRates?: Record<string, number>;
}

export function YieldSummaryCard({
  assets,
  ethSpot,
  btcSpot,
  hasPositions,
  aaveRates,
}: Props) {
  const nextMonday = getNextMonday();
  const nextMondayStr = nextMonday.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  let totalUsd = 0;
  let pendingUsd = 0;
  let deliveredUsd = 0;
  for (const a of assets) {
    totalUsd += toUsd(a.total, a.asset, ethSpot, btcSpot);
    pendingUsd += toUsd(a.pending, a.asset, ethSpot, btcSpot);
    deliveredUsd += toUsd(a.delivered, a.asset, ethSpot, btcSpot);
  }

  const hasYield = totalUsd > 0;
  const nonZeroAssets = assets.filter((a) => a.total > 0);

  if (!hasPositions && !hasYield) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Aave Yield
          </h2>
          <YieldExplainer />
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          Next distribution: {nextMondayStr}
        </span>
      </div>

      {hasYield ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Total Yield
              </p>
              <p className="text-2xl font-bold text-[var(--accent)] font-mono">
                ${fmtYieldUsd(totalUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Pending</p>
              <p className="text-2xl font-bold text-amber-400 font-mono">
                ${fmtYieldUsd(pendingUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Delivered</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">
                ${fmtYieldUsd(deliveredUsd)}
              </p>
            </div>
          </div>

          {nonZeroAssets.length > 0 && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              {nonZeroAssets.map((a) => {
                const usd = toUsd(a.total, a.asset, ethSpot, btcSpot);
                return (
                  <div
                    key={a.asset}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-[var(--text)] font-medium">
                      {assetLabel(a.asset)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[var(--text)]">
                        {fmtAsset(a.total)}
                      </span>
                      <span className="font-mono text-[var(--text-secondary)] text-xs">
                        ${fmtYieldUsd(usd)}
                      </span>
                      <span className="font-mono text-[var(--text-secondary)] text-xs">
                        {formatApr(aaveRates?.[a.asset] ?? 0)} APR
                      </span>
                      <div className="flex gap-1.5">
                        {a.pending > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                            Pending
                          </span>
                        )}
                        {a.delivered > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                            Delivered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-400 font-medium">
                Accruing
              </span>
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Your collateral is earning Aave yield. First distribution
              on {nextMondayStr}.
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-mono">
            USDC {formatApr(aaveRates?.usdc ?? 0)} · WETH {formatApr(aaveRates?.eth ?? 0)} · cbBTC{" "}
            {formatApr(aaveRates?.btc ?? 0)}
          </p>
        </div>
      )}
    </div>
  );
}
