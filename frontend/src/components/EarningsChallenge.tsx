"use client";

import { useEffect, useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { InfoTooltip } from "./ui/InfoTooltip";
import type { LeaderboardTrack1Entry } from "@/lib/api";

// Competition: Apr 1 – Apr 15 2026 UTC
const COMPETITION_END_MS = 1776297599 * 1000;

function truncateWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function useCountdown(targetMs: number): string {
  const [remaining, setRemaining] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (remaining <= 0) return "Ended";
  const totalSecs = Math.floor(remaining / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

function isCurrentUser(wallet: string, address: string | undefined): boolean {
  if (!address) return false;
  return wallet.toLowerCase() === address.toLowerCase();
}

function LeaderboardRow({
  entry,
  address,
  streak,
}: {
  entry: LeaderboardTrack1Entry;
  address: string | undefined;
  streak: number;
}) {
  const mine = isCurrentUser(entry.wallet, address);
  const qualified = entry.qualified;

  return (
    <tr
      className={`border-b border-[var(--border)] transition-colors ${
        mine
          ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
          : qualified
          ? "hover:bg-[var(--surface)]"
          : "opacity-40 hover:opacity-60"
      }`}
    >
      <td className="py-3 px-3 text-sm font-mono text-[var(--text-secondary)] w-8">
        {entry.rank ?? "—"}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-[var(--text)]">
        {truncateWallet(entry.wallet)}
        {mine && (
          <span className="ml-1.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide">
            you
          </span>
        )}
      </td>
      <td className="py-3 px-3 text-sm font-semibold text-[var(--accent)] text-right">
        {entry.earning_rate !== null && entry.earning_rate > 0
          ? `${(entry.earning_rate * 100).toFixed(2)}%`
          : "—"}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right hidden sm:table-cell">
        {streak > 0 ? streak : "—"}
      </td>
    </tr>
  );
}

export function EarningsChallenge({ address }: { address: string | undefined }) {
  const { data, loading, error } = useLeaderboard();
  const countdown = useCountdown(COMPETITION_END_MS);
  const week = data?.meta.current_week ?? 1;

  // Build streak lookup from track2
  const streakByWallet = new Map<string, number>();
  data?.track2.forEach((e) => streakByWallet.set(e.wallet.toLowerCase(), e.otm_streak));

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--bone)]">Earnings Challenge</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Two weeks, two tracks. Set your price, collect premium, and see how you rank.
          The seller with the best earning rate wins $100. The seller with the longest
          run without getting assigned wins $50. Apr 1–15, 2026.
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            Earning Rate
            <InfoTooltip
              title="Earning Rate"
              text="Total premium collected divided by capital committed. The higher the rate, the more you're getting paid per dollar locked. Bonuses from the Wheel and Perfect Week multiply your premium."
            />
          </span>
          <span className="inline-flex items-center gap-1">
            Wheel Bonus ↺
            <InfoTooltip
              title="Wheel Bonus (1.5×)"
              text="The Wheel is the full cycle: sell a put, get assigned (you receive the asset), sell a covered call, get assigned again (you deliver the asset). Each leg earns premium. Complete the cycle and every position in it earns 1.5×."
            />
          </span>
          <span className="inline-flex items-center gap-1">
            Perfect Week
            <InfoTooltip
              title="Perfect Week (1.5×)"
              text="If none of your positions get assigned in a full calendar week, all positions that expire safely that week earn 1.5× premium. Both bonuses can't stack — Wheel takes priority."
            />
          </span>
          <span className="inline-flex items-center gap-1">
            Safe Streak
            <InfoTooltip
              title="Safe Streak"
              text="Longest run of consecutive positions that expired without assignment. A position expires safely when the price stays on your side and you keep the full premium."
            />
          </span>
        </div>
      </div>

      {/* Banner */}
      <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Week {week} of 2
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            ends in {countdown}
          </span>
        </div>
        <div className="flex gap-4 shrink-0 text-xs">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-[var(--text-secondary)]">
              <p>Earning Rate</p>
              <InfoTooltip
                title="Earning Rate"
                text="Total premium collected divided by capital committed. The higher the rate, the more you're getting paid per dollar locked. Bonuses from the Wheel and Perfect Week multiply your premium."
              />
            </div>
            <p className="font-semibold text-[var(--bone)]">$100</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-[var(--text-secondary)]">
              <p>Perfect Run</p>
              <InfoTooltip
                title="Perfect Run"
                text="Complete two full weeks without a single assignment. Every position you open must expire safely — price stays on your side and you keep all the premium. One full week without assignment also earns a 1.5× bonus on that week's premium."
              />
            </div>
            <p className="font-semibold text-[var(--bone)]">$50</p>
          </div>
        </div>
      </div>

      {/* Leaderboard card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
        {loading && (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--text-secondary)] text-center py-8">
            Leaderboard unavailable. Try again later.
          </p>
        )}

        {!loading && !error && data && (
          <>
            <div className="overflow-x-auto">
              {data.track1.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  No entries yet.
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left w-8">#</th>
                      <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left">Wallet</th>
                      <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-right">Rate</th>
                      <th className="py-2 px-3 text-right hidden sm:table-cell">
                        <span className="inline-flex items-center justify-end gap-0.5 text-xs text-[var(--text-secondary)]">
                          Streak
                          <InfoTooltip
                            title="Safe Streak"
                            text="Longest run of consecutive positions that expired without assignment."
                          />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.track1.map((entry) => (
                      <LeaderboardRow
                        key={entry.wallet}
                        entry={entry}
                        address={address}
                        streak={streakByWallet.get(entry.wallet.toLowerCase()) ?? 0}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-secondary)]">
                {data.meta.qualified_participants} qualified · {data.meta.total_participants} total · $500+ committed to qualify
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
