"use client";

import { useState, useMemo, useEffect } from "react";
import { InfoTooltip } from "../ui/InfoTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { RangeOutcomeCards } from "./RangeOutcomeCards";
import { RangeAcceptModal } from "./RangeAcceptModal";
import { fmtUsd, floorTo } from "@/lib/utils";
import { computeAPR, computeROI } from "@/lib/execution";
import { useWallet } from "@/hooks/useWallet";
import type { PriceQuote } from "@/lib/api";
import type { AssetConfig } from "@/lib/assets";
import type { YieldMetric } from "../YieldToggle";

const MIN_DISPLAY_APR = 3;
const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;

interface RangeEarnProps {
  asset: AssetConfig;
  prices: PriceQuote[];
  activeExpiry: string | null;
  spot?: number;
  walletBalance: number;
  amountStr: string;
  onAmountChange: (val: string) => void;
  onAccepted: (info: {
    putStrike: number; callStrike: number;
    totalPremium: number; combinedApr: number;
    amount: number; expiryDays: number;
    putTxHash: string | null; callTxHash: string | null;
  }) => void;
  yieldMetric: YieldMetric;
}

function fmtYield(apr: number, roi: number, metric: YieldMetric): string {
  return metric === "apr"
    ? `${Math.round(apr)}% APR`
    : `${roi.toFixed(1)}% ROI`;
}

export function RangeEarn({
  asset,
  prices,
  activeExpiry,
  spot,
  walletBalance,
  amountStr,
  onAmountChange,
  onAccepted,
  yieldMetric,
}: RangeEarnProps) {
  const { isConnected } = useWallet();
  const [putQuote, setPutQuote] = useState<PriceQuote | null>(null);
  const [callQuote, setCallQuote] = useState<PriceQuote | null>(null);
  const amount = Number(amountStr) || 0;
  const [confirming, setConfirming] = useState(false);

  const putStrikes = useMemo(() => {
    return prices
      .filter(
        (p) =>
          p.option_type === "put" &&
          p.expiry_date === activeExpiry &&
          p.strike < (spot ?? Infinity) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => b.strike - a.strike);
  }, [prices, activeExpiry, spot]);

  const callStrikes = useMemo(() => {
    return prices
      .filter(
        (p) =>
          p.option_type === "call" &&
          p.expiry_date === activeExpiry &&
          p.strike > (spot ?? -Infinity) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => a.strike - b.strike);
  }, [prices, activeExpiry, spot]);

  // Reset selections when strikes change (e.g. expiry switch)
  useEffect(() => {
    setPutQuote((prev) => {
      if (!prev) return prev;
      return putStrikes.find((q) => q.strike === prev.strike) ?? null;
    });
    setCallQuote((prev) => {
      if (!prev) return prev;
      return callStrikes.find((q) => q.strike === prev.strike) ?? null;
    });
  }, [putStrikes, callStrikes]);

  // 50/50 split
  const putAmountUsd = amount / 2;
  const callAmountEth = spot && spot > 0 ? (amount / 2) / spot : 0;

  // Premium calculations
  const putPremium = putQuote && putAmountUsd > 0
    ? (putQuote.premium * putAmountUsd) / putQuote.strike
    : 0;
  const callPremium = callQuote && callAmountEth > 0
    ? callQuote.premium * callAmountEth
    : 0;
  const totalPremium = putPremium + callPremium;

  // Combined APR + ROI (weighted average)
  const putApr = putQuote
    ? computeAPR(putQuote.premium, putQuote.strike, putQuote.expiry_days)
    : 0;
  const callApr = callQuote
    ? computeAPR(callQuote.premium, callQuote.strike, callQuote.expiry_days)
    : 0;
  const putRoi = putQuote ? computeROI(putQuote.premium, putQuote.strike) : 0;
  const callRoi = callQuote ? computeROI(callQuote.premium, callQuote.strike) : 0;
  const combinedRoi = putQuote && callQuote
    ? (putRoi + callRoi) / 2
    : putQuote ? putRoi : callRoi;
  const combinedApr = putQuote && callQuote
    ? (putApr + callApr) / 2
    : putQuote ? putApr : callApr;

  // Total open positions for this expiry (puts + calls)
  const totalRangePositions = useMemo(() => {
    return prices
      .filter(p => p.expiry_date === activeExpiry)
      .reduce((sum, p) => sum + p.position_count, 0);
  }, [prices, activeExpiry]);

  const canAccept = putQuote && callQuote && amount > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
      {/* LEFT: Strike selection + amount */}
      <div className="space-y-5">
        {/* Amount input */}
        <div className="animate-fade-in-up" data-tour="range-amount">
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            Total to commit
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-within:border-[var(--accent)] transition-colors duration-200">
            <div className="flex items-center gap-1.5 shrink-0">
              <img src="/usdc.svg" alt="USDC" className="w-5 h-5 rounded-full" />
              <span className="text-sm font-bold text-[var(--bone)]">USDC</span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1,000"
              value={amountStr}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                  onAmountChange(raw);
                }
              }}
              className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none font-mono text-right"
            />
          </div>
          {amount > 0 && spot && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Split: <span className="font-mono">${putAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> USDC + <span className="font-mono">{callAmountEth.toFixed(4)}</span> {asset.symbol}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                No need to hold {asset.symbol} — we swap automatically if needed
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--text-secondary)]">
              Balance: <span className="font-mono">${floorTo(walletBalance, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
            <div className="flex gap-1.5">
              {PERCENT_SHORTCUTS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    // Reserve 1% for swap slippage on the call side half
                    const effective = walletBalance / 1.01;
                    const truncated = floorTo(effective * (pct / 100), 2);
                    onAmountChange(truncated.toString());
                  }}
                  disabled={walletBalance <= 0}
                  className={`text-xs font-medium transition-colors duration-150 px-2 py-1 min-h-[28px] rounded bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                    walletBalance > 0
                      ? "cursor-pointer text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                      : "text-[var(--text-secondary)] opacity-40 cursor-not-allowed"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dual strike columns */}
        {totalRangePositions > 0 && (
          <div className="flex justify-end animate-fade-in-up">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-default">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 inline-block" />
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{totalRangePositions}</span>
                  <span className="text-xs text-[var(--text-secondary)]">open positions</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Open positions at this expiry</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up" data-tour="range-strikes">
          {/* Put strikes */}
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2 flex items-center">
              Lower bound
              <InfoTooltip title="Lower bound" text={`If ${asset.symbol} drops below this price, you buy at this price and keep the premium.`} />
            </p>
            {putStrikes.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {putStrikes.map((q) => {
                  const apr = computeAPR(q.premium, q.strike, q.expiry_days);
                  const roi = computeROI(q.premium, q.strike);
                  const selected = putQuote?.strike === q.strike;
                  const disabled = !q.otoken_address || q.available_amount <= 0;
                  const dist = spot ? ((q.strike - spot) / spot * 100) : null;
                  return (
                    <button
                      key={q.strike}
                      onClick={() => setPutQuote(q)}
                      disabled={disabled}
                      className={`w-full py-3 px-3 text-left text-sm transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                        disabled ? "opacity-40 cursor-not-allowed"
                        : selected ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)]"
                        : "hover:bg-[var(--surface)] active:bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-semibold ${selected ? "text-[var(--accent)]" : "text-[var(--bone)]"}`}>
                          ${q.strike.toLocaleString()}
                        </span>
                        {q.position_count > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 cursor-default">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 inline-block" />
                                <span className="text-[10px] font-mono text-[var(--text-secondary)]">{q.position_count}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Total open positions at this strike price</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--accent)] font-mono font-bold">{fmtYield(apr, roi, yieldMetric)}</span>
                        {dist != null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-[var(--text-secondary)] font-mono cursor-default">{dist.toFixed(1)}%</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Distance from current price</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No put strikes</p>
            )}
          </div>

          {/* Call strikes */}
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2 flex items-center">
              Upper bound
              <InfoTooltip title="Upper bound" text={`If ${asset.symbol} rises above this price, you sell at this price and keep the premium.`} />
            </p>
            {callStrikes.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {callStrikes.map((q) => {
                  const apr = computeAPR(q.premium, q.strike, q.expiry_days);
                  const roi = computeROI(q.premium, q.strike);
                  const selected = callQuote?.strike === q.strike;
                  const disabled = !q.otoken_address || q.available_amount <= 0;
                  const dist = spot ? ((q.strike - spot) / spot * 100) : null;
                  return (
                    <button
                      key={q.strike}
                      onClick={() => setCallQuote(q)}
                      disabled={disabled}
                      className={`w-full py-3 px-3 text-left text-sm transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                        disabled ? "opacity-40 cursor-not-allowed"
                        : selected ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)]"
                        : "hover:bg-[var(--surface)] active:bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-semibold ${selected ? "text-[var(--accent)]" : "text-[var(--bone)]"}`}>
                          ${q.strike.toLocaleString()}
                        </span>
                        {q.position_count > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 cursor-default">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 inline-block" />
                                <span className="text-[10px] font-mono text-[var(--text-secondary)]">{q.position_count}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Total open positions at this strike price</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--accent)] font-mono font-bold">{fmtYield(apr, roi, yieldMetric)}</span>
                        {dist != null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-[var(--text-secondary)] font-mono cursor-default">+{dist.toFixed(1)}%</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Distance from current price</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No call strikes</p>
            )}
          </div>
        </div>

        {/* Range summary */}
        {putQuote && callQuote && spot && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-sm animate-fade-in-up">
            <span className="font-mono font-semibold text-[var(--bone)]">
              ${putQuote.strike.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              ({(((putQuote.strike - spot) / spot) * 100).toFixed(1)}%)
            </span>
            <span className="text-[var(--text-secondary)]">—</span>
            <span className="font-mono font-semibold text-[var(--bone)]">
              ${callQuote.strike.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              (+{(((callQuote.strike - spot) / spot) * 100).toFixed(1)}%)
            </span>
          </div>
        )}

        {/* Accept button */}
        <div className="animate-fade-in-up" data-tour="range-accept">
          <button
            onClick={() => {
              setConfirming(true);
            }}
            disabled={!canAccept && isConnected}
            className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 ${
              canAccept
                ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] animate-glow scale-[1.02]"
                : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
            }`}
          >
            {!isConnected
              ? "Connect wallet"
              : !amount
                ? "Enter an amount"
                : !putQuote
                  ? "Select lower bound"
                  : !callQuote
                    ? "Select upper bound"
                    : `Accept: Earn $${fmtUsd(totalPremium)}`}
          </button>
        </div>
      </div>

      {/* RangeAcceptModal */}
      {confirming && putQuote && callQuote && (
        <RangeAcceptModal
          putQuote={putQuote}
          callQuote={callQuote}
          putAmountUsd={putAmountUsd}
          callAmountEth={callAmountEth}
          totalPremium={totalPremium}
          spotPrice={spot}
          assetSymbol={asset.symbol}
          assetSlug={asset.slug}
          onClose={() => setConfirming(false)}
          onAccepted={({ putTxHash, callTxHash }) => {
            setConfirming(false);
            onAccepted({
              putStrike: putQuote!.strike,
              callStrike: callQuote!.strike,
              totalPremium,
              combinedApr,
              amount,
              expiryDays: putQuote!.expiry_days,
              putTxHash,
              callTxHash,
            });
          }}
        />
      )}

      {/* RIGHT: Preview */}
      <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
        {canAccept && totalPremium > 0 && (
          <div className="text-center py-2 animate-fade-in-up">
            <div className="flex items-center justify-center gap-1">
              <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                ${fmtUsd(totalPremium)}
              </p>
              <InfoTooltip title="Combined premium" text="Total premium from both put and call legs. Yours to keep no matter what." />
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {fmtYield(combinedApr, combinedRoi, yieldMetric)}
            </p>
          </div>
        )}
        <div data-tour="range-outcomes">
          <RangeOutcomeCards
            putStrike={putQuote?.strike}
            callStrike={callQuote?.strike}
            totalPremium={totalPremium > 0 ? totalPremium : undefined}
            assetSymbol={asset.symbol}
          />
        </div>
      </div>
    </div>
  );
}
