"use client";

import { fmtUsd, fmtAsset } from "@/lib/utils";

interface OutcomeCardsProps {
  side: "buy" | "sell";
  amount?: number;
  strike?: number;
  premium?: number;
  assetSymbol?: string;
}

export function OutcomeCards({
  side,
  amount,
  strike,
  premium,
  assetSymbol = "ETH",
}: OutcomeCardsProps) {
  const isBuy = side === "buy";
  const hasAmount = amount !== undefined && amount > 0;
  const hasStrike = strike !== undefined && strike > 0;
  const hasPremium = premium !== undefined && premium > 0;

  const otmDescription = hasStrike
    ? isBuy
      ? `Price stays above $${strike.toLocaleString()}`
      : `Price stays below $${strike.toLocaleString()}`
    : isBuy
      ? "Price stays above your price"
      : "Price stays below your price";

  const otmCommit = hasAmount
    ? isBuy
      ? `$${amount.toLocaleString()} back`
      : `${amount} ${assetSymbol} back`
    : "Your capital back";

  const otmEarnings = hasPremium
    ? `+ keep $${fmtUsd(premium)}`
    : "+ keep earnings";

  const itmDescription = hasStrike
    ? `Price reaches $${strike.toLocaleString()}`
    : "Price reaches your target";

  const itmAction = hasStrike && hasAmount
    ? isBuy
      ? `You buy ${fmtAsset(amount / strike)} ${assetSymbol} at $${strike.toLocaleString()}`
      : `You sell ${assetSymbol} at $${strike.toLocaleString()}`
    : hasAmount
      ? isBuy
        ? `You buy ${assetSymbol} at your price`
        : `You sell ${amount} ${assetSymbol} at your price`
      : isBuy
        ? `You buy ${assetSymbol} at your price`
        : `You sell ${assetSymbol} at your price`;

  const itmEarnings = otmEarnings;

  const itmNextStep = hasStrike
    ? isBuy
      ? `Next: sell above $${strike.toLocaleString()}`
      : `Next: buy below $${strike.toLocaleString()}`
    : isBuy
      ? "Next: set a sell price"
      : "Next: set a buy price";

  const cardClass = "rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 p-4 space-y-2 relative overflow-hidden";

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* OTM outcome — collateral back + keep premium */}
      <div className={cardClass} data-tour="outcome-otm">
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5.5L4 7.5L8 3"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {otmDescription}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
            {otmCommit}
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {otmEarnings}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Earn again
          </p>
        </div>
      </div>

      {/* ITM outcome — order fills + keep premium + next step */}
      <div className={cardClass} data-tour="outcome-itm">
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M3 5H7"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M5 3L7 5L5 7"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
              {itmDescription}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] mt-1.5">
            {itmAction}
          </p>
          <p className="text-sm font-bold text-[var(--accent)] font-mono">
            {itmEarnings}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {itmNextStep}
          </p>
        </div>
      </div>
    </div>
  );
}
