"use client";

import type { Position, Activity, YieldAssetSummary, YieldPositionTotal } from "@/lib/api";
import { fmtUsd, fmtYieldUsd, getNextMonday } from "@/lib/utils";
import { YieldToggle, type YieldMetric } from "./YieldToggle";
import { InfoTooltip } from "./ui/InfoTooltip";
import { resolvePositionAsset } from "@/lib/assets";
import { getPositionStrike } from "@/lib/positionMath";

interface Props {
  positions: Position[];
  activity: Activity | null;
  yieldMetric: YieldMetric;
  onYieldMetricChange: (metric: YieldMetric) => void;
  yieldAssets?: YieldAssetSummary[];
  yieldPositionTotals?: YieldPositionTotal[];
  okbSpot: number | undefined;
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmtUsd(n)}`;
}

function callDecimals(p: Position): number {
  return 10 ** resolvePositionAsset(p.asset, p.strike_price).collateralDecimals;
}

function capitalUsd(p: Position): number {
  if (p.is_put) return p.collateral / 1e6;
  return (p.collateral / callDecimals(p)) * getPositionStrike(p);
}

function toUsd(
  amount: number,
  _asset: string,
  okbSpot: number | undefined,
): number {
  if (_asset === "usdc") return amount;
  return amount * (okbSpot ?? 0);
}

export function PortfolioSummary({
  positions,
  activity,
  yieldMetric,
  onYieldMetricChange,
  yieldAssets,
  yieldPositionTotals,
  okbSpot,
}: Props) {
  const premiumEarned = positions.reduce(
    (sum, p) => sum + Number(p.net_premium) / 1e6,
    0,
  );

  const activeCapital = positions
    .filter((p) => !p.is_settled)
    .reduce((sum, p) => sum + capitalUsd(p), 0);

  const totalCapital = positions.reduce(
    (sum, p) => sum + capitalUsd(p),
    0,
  );

  const totalWeightedApr = positions.reduce((sum, p) => {
    const capital = capitalUsd(p);
    const premium = Number(p.net_premium) / 1e6;
    const indexedTime = new Date(p.indexed_at).getTime();
    const days = Math.max(
      1,
      Math.floor((p.expiry * 1000 - indexedTime) / 86_400_000),
    );
    const apr =
      capital > 0 ? (premium / capital) * (365 / days) * 100 : 0;
    return sum + apr * capital;
  }, 0);
  const avgApr = totalCapital > 0 ? totalWeightedApr / totalCapital : 0;
  const avgRoi =
    totalCapital > 0 ? (premiumEarned / totalCapital) * 100 : 0;

  const metricValue = yieldMetric === "apr" ? avgApr : avgRoi;

  // Yield from backend — use position totals (same source as card data)
  let accruingYieldUsd = 0;
  if (yieldPositionTotals) {
    for (const t of yieldPositionTotals) {
      accruingYieldUsd += toUsd(
        t.estimated_yield, t.asset, okbSpot,
      );
    }
  }
  let deliveredYieldUsd = 0;
  if (yieldAssets) {
    for (const a of yieldAssets) {
      deliveredYieldUsd += toUsd(a.delivered, a.asset, okbSpot);
    }
  }

  const hasActivePositions = positions.some((p) => !p.is_settled);
  const nextMondayStr = getNextMonday().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-semibold tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          OG Supporter
        </span>
        {activity && activity.daysSinceFirst > 0 && (
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            Member for {activity.daysSinceFirst}d
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            Total Earned
          </p>
          <p className="text-xl font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(premiumEarned)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            Active Capital
          </p>
          <p className="text-xl font-bold text-[var(--bone)] font-mono">
            {formatUSD(activeCapital)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs text-[var(--text-secondary)]">Avg</p>
            <YieldToggle
              value={yieldMetric}
              onChange={onYieldMetricChange}
            />
          </div>
          <p className="text-xl font-bold text-[var(--accent)] font-mono">
            {metricValue < 10
              ? metricValue.toFixed(1)
              : Math.round(metricValue)}
            %
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Positions</p>
          <p className="text-xl font-bold text-[var(--bone)] font-mono">
            {activity?.positionCount ?? positions.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Total Traded</p>
          <p className="text-xl font-bold text-[var(--bone)] font-mono">
            {activity ? formatUSD(activity.totalVolume) : formatUSD(0)}
          </p>
        </div>

        {hasActivePositions && (
          <>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-[var(--text-secondary)]">
                  Aave Yield
                </p>
                <InfoTooltip
                  title="Aave Yield"
                  text={`Your collateral earns yield in Aave V3 while your position is open. Distributed every Monday via airdrop. Next: ${nextMondayStr}.`}
                />
              </div>
              <p className="text-xl font-bold text-amber-400 font-mono">
                ${fmtYieldUsd(accruingYieldUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">
                Distributed
              </p>
              <p className="text-xl font-bold text-[var(--bone)] font-mono">
                ${fmtYieldUsd(deliveredYieldUsd)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
