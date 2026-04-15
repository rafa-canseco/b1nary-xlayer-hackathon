"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePrices } from "@/hooks/usePrices";
import { useSpot } from "@/hooks/useSpot";
import { useCapacity } from "@/hooks/useCapacity";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { AcceptModal } from "../AcceptModal";
import { LivePrice } from "../LivePrice";
import { HowItWorksDrawer } from "../HowItWorksDrawer";
import { InfoTooltip } from "../ui/InfoTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { OutcomeCards } from "./OutcomeCards";
import { CHAIN } from "@/lib/contracts";
import { fmtUsd, floorTo, buildTweetUrl } from "@/lib/utils";
import { formatApr } from "@/lib/yield";
import { useAaveRates } from "@/hooks/useAaveRates";
import type { PriceQuote } from "@/lib/api";
import type { AssetConfig } from "@/lib/assets";
import { AssetSelector } from "./AssetSelector";
import { RangeEarn } from "./RangeEarn";
import { YieldToggle, type YieldMetric } from "../YieldToggle";
import { computeAPR, computeROI } from "@/lib/execution";
import { startBuyTour, startSellTour, startRangeTour } from "./EarnTutorial";

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed; uses local time
}

function expiryLabel(expiryDate: string): string {
  const d = parseLocalDate(expiryDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseLocalDate(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PERCENT_SHORTCUTS = [25, 50, 75, 100] as const;
const MIN_DISPLAY_APR = 3;
function fmtYield(apr: number, roi: number, metric: YieldMetric): string {
  return metric === "apr"
    ? `${Math.round(apr)}% APR`
    : `${roi.toFixed(1)}% ROI`;
}

function StrikeCard({
  quote,
  side,
  amount,
  isSelected,
  onSelect,
  assetSymbol: symbol,
  spot,
  yieldMetric,
  positionCount,
}: {
  quote: PriceQuote;
  side: "buy" | "sell";
  amount: number;
  isSelected: boolean;
  onSelect: () => void;
  assetSymbol: string;
  spot?: number;
  yieldMetric: YieldMetric;
  positionCount: number;
}) {
  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const roi = computeROI(quote.premium, quote.strike);
  const disabled = !quote.otoken_address || quote.available_amount <= 0;

  const isBuy = side === "buy";
  const earnings = amount > 0
    ? isBuy
      ? (quote.premium * amount) / quote.strike
      : quote.premium * amount
    : 0;

  const distancePct = spot && spot > 0
    ? ((quote.strike - spot) / spot) * 100
    : null;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full grid grid-cols-[1fr_auto_1fr] items-center py-4 px-5 transition-all duration-200 text-left group focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : isSelected
            ? "bg-[var(--accent)]/8 border-l-2 border-l-[var(--accent)] cursor-pointer"
            : "hover:bg-[var(--surface)] hover:pl-6 cursor-pointer active:bg-[var(--surface)]"
      }`}
    >
      {/* Left: strike + distance */}
      <div>
        <span className={`text-base font-semibold font-mono ${isSelected ? "text-[var(--accent)]" : "text-[var(--bone)]"} transition-all duration-200 inline-block`}>
          ${quote.strike.toLocaleString()}/{symbol}
        </span>
        {distancePct != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono cursor-default">
                {distancePct > 0 ? "+" : ""}{distancePct.toFixed(1)}%
              </p>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Distance from current price</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Center: position count */}
      <div className="flex items-center justify-center px-3">
        {positionCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 cursor-default">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 inline-block" />
                <span className="text-xs font-mono text-[var(--text-secondary)]">{positionCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Total open positions at this strike price</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Right: earnings / APR */}
      <div className="text-right">
        {earnings > 0 ? (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(earnings)}
          </span>
        ) : (
          <span className="text-base font-bold text-[var(--accent)] font-mono">
            {fmtYield(apr, roi, yieldMetric)}
          </span>
        )}
        {earnings > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{fmtYield(apr, roi, yieldMetric)}</p>
        )}
      </div>
    </button>
  );
}

export function PriceMenuV2({ asset }: { asset: AssetConfig }) {
  const { prices, loading, error, refresh } = usePrices(asset.slug);
  const { rates: aaveRates } = useAaveRates();
  const { spot: spotFromEndpoint } = useSpot(asset.slug, 5_000);
  const spot = spotFromEndpoint ?? prices[0]?.spot;
  const { capacity } = useCapacity(asset.slug);
  const { address, isConnected } = useWallet();
  const { usd, eth, weth, wbtc, okb } = useBalances(address);
  const searchParams = useSearchParams();
  const sideParam = searchParams.get("side");
  const amountParam = searchParams.get("amount");
  const initialSide = sideParam === "sell" ? "sell" : sideParam === "range" ? "range" : "buy";
  const [side, setSide] = useState<"buy" | "sell" | "range">(initialSide);
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState<{ quote: PriceQuote; side: "buy" | "sell"; amount: number; txHash: string | null } | null>(null);
  const [rangeAccepted, setRangeAccepted] = useState<{
    putStrike: number; callStrike: number;
    totalPremium: number; combinedApr: number;
    amount: number; expiryDays: number;
    putTxHash: string | null; callTxHash: string | null;
  } | null>(null);

  const [amountStr, setAmountStr] = useState(amountParam ?? "");
  const amount = Number(amountStr) || 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [yieldMetric, setYieldMetric] = useState<YieldMetric>("apr");

  const isBuy = side === "buy";
  const isBtc = asset.slug === "btc";
  const isOkb = asset.slug === "okb";
  const walletBalance = isBuy
    ? usd
    : isOkb ? okb : isBtc ? wbtc : eth + weth;

  const expiries = useMemo(() => {
    const seen = new Set<string>();
    for (const p of prices) {
      seen.add(p.expiry_date);
    }
    return [...seen].sort();   // ISO strings sort correctly lexicographically
  }, [prices]);

  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const activeExpiry = selectedExpiry ?? expiries[0] ?? null;

  const marketClosed = capacity !== null && (!capacity.market_open || capacity.market_status === "full");
  const marketDegraded = capacity !== null && capacity.market_status === "degraded";
  const capEth = capacity?.max_position ?? asset.maxAmount;
  const capUsd = spot ? Math.min(asset.maxAmountUsd, capEth * spot) : asset.maxAmountUsd;

  const filteredPrices = useMemo(() => {
    return prices
      .filter(
        (p) =>
          p.option_type === (side === "buy" ? "put" : "call") &&
          p.expiry_date === activeExpiry &&
          (side === "buy" ? p.strike < (spot ?? Infinity) : p.strike > (spot ?? -Infinity)) &&
          computeAPR(p.premium, p.strike, p.expiry_days) >= MIN_DISPLAY_APR
      )
      .sort((a, b) => side === "buy" ? b.strike - a.strike : a.strike - b.strike);
  }, [prices, side, activeExpiry, spot]);

  // Total open positions for this expiry (puts in buy, calls in sell)
  const totalPositionsForExpiry = useMemo(() => {
    const optionType = side === "buy" ? "put" : "call";
    return prices
      .filter(p => p.expiry_date === activeExpiry && p.option_type === optionType)
      .reduce((sum, p) => sum + p.position_count, 0);
  }, [prices, activeExpiry, side]);

  // When filters change, try to keep the same strike selected
  useEffect(() => {
    setSelectedQuote((prev) => {
      if (!prev) return prev;
      const match = filteredPrices.find((q) => q.strike === prev.strike);
      if (!match) return null;
      if (match.premium !== prev.premium || match.expiry_days !== prev.expiry_days) return match;
      return prev;
    });
  }, [filteredPrices]);

  const selectedEarnings =
    selectedQuote && amount > 0 && selectedQuote.strike > 0
      ? isBuy
        ? (selectedQuote.premium * amount) / selectedQuote.strike
        : selectedQuote.premium * amount
      : 0;

  const selectedApr = selectedQuote
    ? computeAPR(selectedQuote.premium, selectedQuote.strike, selectedQuote.expiry_days)
    : 0;

  const canAccept = selectedQuote && amount > 0 && selectedQuote.otoken_address;

  function handleStartTutorial() {
    const onComplete = () => {};

    if (side === "range") {
      setTimeout(() => startRangeTour(asset.symbol, onComplete), 150);
      return;
    }

    // Pre-fill for buy/sell so cards show real numbers
    const sellPreFill = String(Number(asset.amountPlaceholder) / 10 || 0.05);
    setAmountStr(isBuy ? "100" : sellPreFill);
    if (filteredPrices.length > 0) {
      setSelectedQuote(filteredPrices[0]);
    }

    setTimeout(() => {
      if (side === "sell") {
        startSellTour(asset.symbol, onComplete);
      } else {
        startBuyTour(asset.symbol, onComplete);
      }
    }, 200);
  }

  function handlePercentShortcut(pct: number) {
    const raw = walletBalance * (pct / 100);
    if (isBuy) {
      const truncated = floorTo(raw, 2);
      setAmountStr(Math.min(truncated, capUsd).toString());
    } else {
      const truncated = floorTo(raw, asset.displayDecimals);
      setAmountStr(Math.min(truncated, capEth).toString());
    }
  }

  if (loading && prices.length === 0 && !spot) {
    return (
      <div className="space-y-3">
        <div className="h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
        Could not load prices. Is the backend running?
      </div>
    );
  }

  if (accepted) {
    const { quote: aq, side: as_, amount: aa, txHash: aTxHash } = accepted;
    const abuy = as_ === "buy";
    const premium = abuy ? (aq.premium * aa) / aq.strike : aq.premium * aa;
    const commitLabel = abuy ? `$${aa.toLocaleString()}` : `${aa} ${asset.symbol}`;
    const apr = computeAPR(aq.premium, aq.strike, aq.expiry_days);
    const roi = computeROI(aq.premium, aq.strike);
    const explorerUrl = CHAIN.blockExplorers?.default.url;

    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <div>
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(premium)}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">earned. Yours to keep.</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {fmtYield(apr, roi, yieldMetric)}
        </p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>{commitLabel} committed for {aq.expiry_days} days</p>
          <p>{abuy ? "Buy" : "Sell"} {asset.symbol} at ${aq.strike.toLocaleString()}/{asset.symbol}</p>
        </div>
        {aTxHash && explorerUrl && (
          <a
            href={`${explorerUrl}/tx/${aTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-[var(--accent)] hover:underline"
          >
            View transaction ↗
          </a>
        )}
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(apr, asset.symbol, abuy ? "buy" : "sell"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setAccepted(null); setSelectedQuote(null); setAmountStr(""); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Accept another price
        </button>
      </div>
    );
  }

  if (rangeAccepted) {
    const explorerUrl2 = CHAIN.blockExplorers?.default.url;
    return (
      <div className="text-center space-y-5 py-10 animate-fade-in-up">
        <div>
          <p className="text-4xl font-bold text-[var(--accent)] font-mono">
            ${fmtUsd(rangeAccepted.totalPremium)}
          </p>
          <p className="text-base text-[var(--text-secondary)] mt-2">earned from both sides. Yours to keep.</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {fmtYield(
            rangeAccepted.combinedApr,
            rangeAccepted.combinedApr * rangeAccepted.expiryDays / 365,
            yieldMetric,
          )}
        </p>
        <div className="h-px bg-[var(--border)]" />
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>Range: ${rangeAccepted.putStrike.toLocaleString()} – ${rangeAccepted.callStrike.toLocaleString()}</p>
          <p>${rangeAccepted.amount.toLocaleString()} committed for {rangeAccepted.expiryDays} days</p>
        </div>
        {(rangeAccepted.putTxHash || rangeAccepted.callTxHash) && explorerUrl2 && (
          <div className="flex justify-center gap-3 text-sm">
            {rangeAccepted.putTxHash && (
              <a
                href={`${explorerUrl2}/tx/${rangeAccepted.putTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Lower tx ↗
              </a>
            )}
            {rangeAccepted.callTxHash && (
              <a
                href={`${explorerUrl2}/tx/${rangeAccepted.callTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Upper tx ↗
              </a>
            )}
          </div>
        )}
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(rangeAccepted.combinedApr, asset.symbol, "range"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setRangeAccepted(null); setSide("range"); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Set another range
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm font-semibold text-[var(--accent)] animate-fade-in-up">
        <button
          onClick={handleStartTutorial}
          disabled={loading || prices.length === 0 || (side !== "range" && filteredPrices.length === 0)}
          className="cursor-pointer rounded-lg bg-[var(--accent)] text-[var(--bg)] px-4 py-1.5 hover:bg-[var(--accent-hover)] transition-all animate-shimmer-pulse focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:animate-none"
        >
          Guide me through it
        </button>
        <button
          onClick={() => setDrawerOpen(true)}
          className="cursor-pointer rounded-lg border border-[var(--accent)]/30 px-3 py-1.5 hover:bg-[var(--accent)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        >
          How does this work?
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/llms.txt`;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }).catch(() => {});
          }}
          className="cursor-pointer rounded-lg border border-[var(--accent)]/30 px-3 py-1.5 hover:bg-[var(--accent)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        >
          {copied ? "Copied!" : "Share with your AI"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-3 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <AssetSelector current={asset} />
          <LivePrice spot={spot} />
        </div>
        <div className="flex items-center gap-3">
          <YieldToggle value={yieldMetric} onChange={setYieldMetric} />
          {capacity && (
            <span className={`text-xs font-medium ${
              marketClosed
                ? "text-[var(--danger)]"
                : marketDegraded
                  ? "text-amber-400"
                  : "text-[var(--accent)]"
            }`}>
              {marketClosed ? "● Closed" : marketDegraded ? "● Limited" : "● Open"}
            </span>
          )}
        </div>
      </div>

      {/* Buy/Sell/Range toggle + content */}
      <div className="space-y-5">
        {/* 1. Buy / Sell / Range toggle */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex animate-fade-in-up">
            <button
              data-tour="tab-buy"
              onClick={() => { setSide("buy"); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-base font-semibold rounded-lg transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                side === "buy"
                  ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I have USD
            </button>
            <button
              data-tour="tab-sell"
              onClick={() => { setSide("sell"); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-base font-semibold rounded-lg transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                side === "sell"
                  ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              I have {asset.symbol}
            </button>
            <button
              onClick={() => { setSide("range"); setSelectedQuote(null); }}
              className={`flex-1 py-2.5 text-base font-semibold rounded-lg transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                side === "range"
                  ? "bg-[var(--bg)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              Range
            </button>
          </div>

          {/* Context line — explains the benefit and why you get paid */}
          <div className="animate-fade-in-up space-y-1" data-tour="context-line">
            {side === "buy" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  Buy {asset.symbol} cheaper.
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Set a price you&apos;d buy {asset.symbol} at. A market maker pays you for that commitment.
                  Price hits? You buy. Doesn&apos;t? Your dollars come back. You keep the payment either way.
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Your USDC also earns {formatApr(aaveRates.usdc ?? 0)} APR via Aave while committed
                </p>
              </>
            )}
            {side === "sell" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  Sell {asset.symbol} higher.
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Set a price you&apos;d sell {asset.symbol} at. A market maker pays you for that commitment.
                  Price hits? You sell at your price. Doesn&apos;t? Your {asset.symbol} comes back. You keep the payment either way.
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Your {asset.symbol} also earns {formatApr(aaveRates[asset.slug] ?? 0)} APR via Aave while committed
                </p>
              </>
            )}
            {side === "range" && (
              <>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  Earn from both sides.
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Set a buy price and a sell price. You earn from both commitments.
                  If {asset.symbol} stays in your range, everything comes back. You keep both payments.
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Collateral earns Aave yield: {formatApr(aaveRates.usdc ?? 0)} on USDC · {formatApr(aaveRates[asset.slug] ?? 0)} on {asset.symbol}
                </p>
              </>
            )}
          </div>

          {/* 2. Duration — button group */}
          {expiries.length > 0 && (
            <div className="animate-fade-in-up" data-tour="duration">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Duration</p>
              <div className="flex flex-wrap gap-2">
                {expiries.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedExpiry(d); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                      activeExpiry === d
                        ? "bg-[var(--accent)] text-[var(--bg)] shadow-sm"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:shadow-sm"
                    }`}
                  >
                    {expiryLabel(d)} ({daysUntil(d)}d)
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>{/* end toggle + duration wrapper */}

      {/* Range mode */}
      {side === "range" && (
        <RangeEarn
          asset={asset}
          prices={prices}
          activeExpiry={activeExpiry}
          spot={spot}
          walletBalance={usd}
          amountStr={amountStr}
          onAmountChange={setAmountStr}
          onAccepted={setRangeAccepted}
          yieldMetric={yieldMetric}
        />
      )}

      {/* Buy/Sell mode */}
      {side !== "range" && (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1fr)] gap-8">
        <div className="space-y-5">
          {/* 3. Amount input + % shortcuts */}
          <div className="animate-fade-in-up" data-tour="amount">
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              How much do you want to commit?
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-within:border-[var(--accent)] transition-colors duration-200">
              <div className="flex items-center gap-1.5 shrink-0">
                <img
                  src={isBuy ? "/usdc.svg" : isOkb ? "/okb.svg" : `/${asset.slug === "btc" ? "cbbtc.webp" : "eth.png"}`}
                  alt={isBuy ? "USDC" : asset.symbol}
                  className="w-5 h-5 rounded-full"
                />
                <span className="text-sm font-bold text-[var(--bone)]">
                  {isBuy ? "USDC" : asset.symbol}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder={isBuy ? "1,000" : asset.amountPlaceholder}
                value={amountStr}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                    setAmountStr(raw);
                  }
                }}
                className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none font-mono text-right"
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-[var(--text-secondary)]">
                Balance: <span className="font-mono">{isBuy
                  ? `$${floorTo(walletBalance, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${floorTo(walletBalance, asset.displayDecimals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: asset.displayDecimals })} ${asset.symbol}`}</span>
              </p>
              <div className="flex gap-1.5">
                {PERCENT_SHORTCUTS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercentShortcut(pct)}
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

          {/* 4. Strike price cards */}
          <div className="animate-fade-in-up" data-tour="strikes">
            <div className="text-sm text-[var(--text-secondary)] flex items-center justify-between mb-2">
              <span className="flex items-center">
                {amount > 0 ? "Choose your strike price" : "Enter an amount to see earnings per strike"}
                <InfoTooltip title="Strike price" text={`The price at which you commit to buy (or sell) ${asset.symbol}. Lower = safer, higher = more premium.`} />
              </span>
              {totalPositionsForExpiry > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1.5 cursor-default">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 inline-block" />
                      <span className="text-xs font-mono">{totalPositionsForExpiry}</span>
                      <span className="text-xs text-[var(--text-secondary)]">open positions</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Open positions at this expiry</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {filteredPrices.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                {filteredPrices.map((q) => (
                  <StrikeCard
                    key={`${q.strike}-${q.expiry_date}`}
                    quote={q}
                    side={side as "buy" | "sell"}
                    amount={amount}
                    isSelected={selectedQuote?.strike === q.strike}
                    onSelect={() => setSelectedQuote(q)}
                    assetSymbol={asset.symbol}
                    spot={spot}
                    yieldMetric={yieldMetric}
                    positionCount={q.position_count}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] text-center">
                {marketClosed ? "MM is at capacity. Check back soon." : "No prices available for this date."}
              </div>
            )}
          </div>

          {/* 5. Accept button — desktop only (mobile renders after outcome cards) */}
          <div className="hidden lg:block space-y-2 animate-fade-in-up" data-tour="accept">
            <button
              onClick={() => {
                setConfirming(true);
              }}
              disabled={marketClosed || (!canAccept && isConnected)}
              className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 ${
                !marketClosed && canAccept
                  ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] animate-glow scale-[1.02]"
                  : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
              }`}
            >
              {marketClosed
                ? "Market temporarily closed"
                : !isConnected
                  ? "Connect wallet"
                  : !amount
                    ? "Enter an amount"
                    : !selectedQuote
                      ? "Select a strike price"
                      : `Accept: Earn $${fmtUsd(selectedEarnings)}`}
            </button>
            {marketClosed && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                The MM is at capacity. Check back soon.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Live preview — outcome cards */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {selectedQuote && amount > 0 && (
            <div className="text-center py-2 animate-fade-in-up">
              <div className="flex items-center justify-center gap-1">
                <p className="text-3xl font-bold text-[var(--accent)] font-mono">
                  ${fmtUsd(selectedEarnings)}
                </p>
                <InfoTooltip title="Premium" text="Paid to you upfront. Yours to keep no matter what happens with the price." />
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {fmtYield(selectedApr, selectedQuote ? computeROI(selectedQuote.premium, selectedQuote.strike) : 0, yieldMetric)} · {activeExpiry ? daysUntil(activeExpiry) : 0}d
              </p>
            </div>
          )}
          {activeExpiry && (
            <div className="text-center animate-fade-in-up">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Settlement: <span className="font-mono text-[var(--bone)]">{parseLocalDate(activeExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · 8:00 AM UTC</span>
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                The exact price at that moment decides the outcome.
              </p>
            </div>
          )}
          <OutcomeCards
            side={side as "buy" | "sell"}
            amount={amount > 0 ? amount : undefined}
            strike={selectedQuote?.strike}
            premium={selectedEarnings > 0 ? selectedEarnings : undefined}
            assetSymbol={asset.symbol}
          />

          {/* Accept button — mobile only, after outcome cards */}
          <div className="lg:hidden space-y-2 animate-fade-in-up">
            <button
              onClick={() => {
                setConfirming(true);
              }}
              disabled={marketClosed || (!canAccept && isConnected)}
              className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 ${
                !marketClosed && canAccept
                  ? "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] animate-glow scale-[1.02]"
                  : "bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40"
              }`}
            >
              {marketClosed
                ? "Market temporarily closed"
                : !isConnected
                  ? "Connect wallet"
                  : !amount
                    ? "Enter an amount"
                    : !selectedQuote
                      ? "Select a strike price"
                      : `Accept: Earn $${fmtUsd(selectedEarnings)}`}
            </button>
            {marketClosed && (
              <p className="text-xs text-center text-[var(--text-secondary)]">
                The MM is at capacity. Check back soon.
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* AcceptModal — only opens on Accept click, confirmation-only */}
      {confirming && selectedQuote && (
        <AcceptModal
          quote={selectedQuote}
          side={side as "buy" | "sell"}
          initialAmount={amountStr}
          confirmOnly
          maxPositionEth={capacity?.max_position}
          assetSymbol={asset.symbol}
          assetSlug={asset.slug}
          yieldMetric={yieldMetric}
          onClose={() => setConfirming(false)}
          onAccepted={({ amount: amt, txHash: hash }) => {
            setConfirming(false);
            setAccepted({ quote: selectedQuote, side: side as "buy" | "sell", amount: amt, txHash: hash });
          }}
        />
      )}

      <HowItWorksDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
