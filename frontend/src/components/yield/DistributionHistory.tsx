"use client";

import { useState } from "react";
import type { YieldDistribution } from "@/lib/api";
import { ASSETS } from "@/lib/assets";
import { CHAIN } from "@/lib/contracts";
import { fmtYieldUsd, fmtAsset } from "@/lib/utils";

const EXPLORER = CHAIN.blockExplorers?.default.url ?? null;
const INITIAL_SHOW = 10;

const FILTER_OPTIONS = [
  { slug: null, label: "All" },
  { slug: "usdc", label: "USDC" },
  { slug: "eth", label: "WETH" },
  { slug: "btc", label: "cbBTC" },
];

function assetLabel(slug: string): string {
  if (slug === "usdc") return "USDC";
  return ASSETS[slug]?.wrappedSymbol ?? slug.toUpperCase();
}

function toUsd(
  amount: number,
  asset: string,
  okbSpot: number | undefined,
): number {
  if (asset === "usdc") return amount;
  return amount * (okbSpot ?? 0);
  return 0;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  history: YieldDistribution[];
  okbSpot: number | undefined;
}

export function DistributionHistory({ history, okbSpot }: Props) {
  const [filter, setFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const filtered = filter
    ? history.filter((d) => d.asset === filter)
    : history;
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_SHOW);
  const hasMore = filtered.length > INITIAL_SHOW;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Distribution history
        </h2>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setFilter(opt.slug);
                setShowAll(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === opt.slug
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No distributions yet
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-2.5 font-medium">Date</th>
                  <th className="text-left px-5 py-2.5 font-medium">Asset</th>
                  <th className="text-right px-5 py-2.5 font-medium">
                    Amount
                  </th>
                  <th className="text-center px-5 py-2.5 font-medium">
                    Status
                  </th>
                  <th className="text-right px-5 py-2.5 font-medium">
                    Tx Hash
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const usd = toUsd(d.amount, d.asset, okbSpot);
                  return (
                    <tr
                      key={d.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                    >
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        {fmtDate(d.created_at)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text)] font-medium">
                        {assetLabel(d.asset)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono text-[var(--text)]">
                          {fmtAsset(d.amount)}
                        </span>
                        <span className="font-mono text-[var(--text-secondary)] text-xs ml-1.5">
                          (${fmtYieldUsd(usd)})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            d.status === "delivered"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {d.status === "delivered" ? "Delivered" : "Pending"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs">
                        {d.airdrop_tx_hash && EXPLORER ? (
                          <a
                            href={`${EXPLORER}/tx/${d.airdrop_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline"
                          >
                            {truncateHash(d.airdrop_tx_hash)}
                          </a>
                        ) : (
                          <span className="text-[var(--text-secondary)]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && !showAll && (
            <div className="px-5 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => setShowAll(true)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Show all {filtered.length} distributions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
