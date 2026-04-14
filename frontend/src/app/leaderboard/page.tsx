"use client";

import { useState, useEffect } from "react";
import { EarningsChallenge } from "@/components/EarningsChallenge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useWallet } from "@/hooks/useWallet";
import { api, type LeaderboardMe } from "@/lib/api";

// Competition window: Apr 1 – Apr 15 2026 UTC
const COMPETITION_START = 1775001600;
const COMPETITION_END = 1776297599;

const MIN_COLLATERAL = 500;

function useLeaderboardMe(address: string | undefined) {
  const [data, setData] = useState<LeaderboardMe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    api
      .getLeaderboardMe(address, COMPETITION_START, COMPETITION_END)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return { data, loading };
}

function YourProgress({ address }: { address: string | undefined }) {
  const { data, loading } = useLeaderboardMe(address);

  if (!address) return null;

  const earningRate = data?.earning_rate ?? null;
  const earned = data?.total_earned_usd ?? 0;
  const collateral = data?.total_collateral_usd ?? 0;
  const collateralOk = collateral >= MIN_COLLATERAL;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
        Your progress · competition period
      </p>

      {loading ? (
        <div className="h-8 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : (
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Earning Rate</p>
            <p className="text-2xl font-bold text-[var(--accent)] font-mono">
              {earningRate !== null && earningRate > 0
                ? `${(earningRate * 100).toFixed(2)}%`
                : "—"}
            </p>
            {earned > 0 && (
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                ${earned.toFixed(2)} earned
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 ml-auto">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${collateralOk ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
              <span className={`text-xs ${collateralOk ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                ${Math.round(collateral).toLocaleString()} / $500 committed
              </span>
              <InfoTooltip
                title="$500 committed"
                text="Total collateral locked across all your positions in the competition period must reach $500 to qualify for prizes."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { address } = useWallet();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-4">
      <h1 className="sr-only">Earnings Challenge Leaderboard</h1>
      <YourProgress address={address} />
      <EarningsChallenge address={address} />
    </main>
  );
}
