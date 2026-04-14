"use client";

import { fmtUsd } from "@/lib/utils";

interface RangeOutcomeCardsProps {
  putStrike?: number;
  callStrike?: number;
  totalPremium?: number;
  assetSymbol?: string;
}

export function RangeOutcomeCards({
  putStrike,
  callStrike,
  totalPremium,
  assetSymbol = "ETH",
}: RangeOutcomeCardsProps) {
  const hasPremium = totalPremium !== undefined && totalPremium > 0;
  const hasStrikes = putStrike !== undefined && callStrike !== undefined;
  const premiumText = hasPremium
    ? `+ $${fmtUsd(totalPremium)} earned`
    : "+ keep earnings";

  const cardClass = "rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-2 relative overflow-hidden";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* Below range — end up holding asset */}
      <div className={cardClass}>
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 7L5 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 5L5 7L7 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {hasStrikes ? `Below $${putStrike.toLocaleString()}` : "If price drops"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)]">
            You buy {assetSymbol} at ${hasStrikes ? putStrike.toLocaleString() : "your lower price"}
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {premiumText}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Next: sell {assetSymbol} higher
          </p>
        </div>
      </div>

      {/* In range — everything back */}
      <div className={cardClass}>
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.5L4 7.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {hasStrikes ? `$${putStrike.toLocaleString()} – $${callStrike.toLocaleString()}` : "Stays in range"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)]">
            Everything back
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {premiumText}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Earn again
          </p>
        </div>
      </div>

      {/* Above range — end up holding USDC */}
      <div className={cardClass}>
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 3L5 7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 5L5 3L7 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {hasStrikes ? `Above $${callStrike.toLocaleString()}` : "If price rises"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)]">
            You sell {assetSymbol} at ${hasStrikes ? callStrike.toLocaleString() : "your upper price"}
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {premiumText}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Next: buy {assetSymbol} cheaper
          </p>
        </div>
      </div>
    </div>
  );
}
