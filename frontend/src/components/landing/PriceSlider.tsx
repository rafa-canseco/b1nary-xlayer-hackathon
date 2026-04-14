"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { usePrices } from "@/hooks/usePrices";
import { useSliderAnalytics } from "@/hooks/useSliderAnalytics";
import type { PriceQuote } from "@/lib/api";
import { SimulationResult } from "./SimulationResult";

const STRIKE_INTERVAL = 100; // $100 increments

/** Compute strike range based on side */
function strikeRange(spot: number, side: "buy" | "sell"): { low: number; high: number } {
  if (side === "buy") {
    return {
      low: Math.ceil((spot * 0.8) / STRIKE_INTERVAL) * STRIKE_INTERVAL,
      high: Math.floor((spot * 0.98) / STRIKE_INTERVAL) * STRIKE_INTERVAL,
    };
  }
  // sell: spot + 2% to spot + 20%
  return {
    low: Math.ceil((spot * 1.02) / STRIKE_INTERVAL) * STRIKE_INTERVAL,
    high: Math.floor((spot * 1.2) / STRIKE_INTERVAL) * STRIKE_INTERVAL,
  };
}

/** Default strike: ~10% OTM */
function defaultStrikeFor(spot: number, side: "buy" | "sell"): number {
  const target = side === "buy" ? spot * 0.9 : spot * 1.1;
  return Math.round(target / STRIKE_INTERVAL) * STRIKE_INTERVAL;
}

/** Generate all discrete strikes for mobile pills */
function generateStrikes(low: number, high: number): number[] {
  const strikes: number[] = [];
  for (let s = low; s <= high; s += STRIKE_INTERVAL) {
    strikes.push(s);
  }
  return strikes;
}

/** Find the closest 7-day quote matching the user's strike and side */
function findMatchingQuote(
  prices: PriceQuote[],
  strike: number,
  side: "buy" | "sell",
): PriceQuote | null {
  const optionType = side === "buy" ? "put" : "call";
  const candidates = prices.filter(
    (q) => q.option_type === optionType && q.expiry_days <= 8,
  );
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const q of candidates) {
    if (Math.abs(q.strike - strike) < Math.abs(best.strike - strike)) {
      best = q;
    }
  }
  return best;
}

/** Realistic fallback premium (~0.5-2% of strike/week) */
function estimatePremium(strike: number, side: "buy" | "sell", spot: number): number {
  if (spot <= 0 || strike <= 0) return 0;
  const distance = side === "buy"
    ? (spot - strike) / spot
    : (strike - spot) / spot;
  const distPct = Math.max(0, Math.min(distance, 0.25));
  const weeklyPct = 0.005 + (0.15 - distPct) * 0.1;
  const clampedPct = Math.max(0.003, Math.min(weeklyPct, 0.02));
  return Math.round(strike * clampedPct);
}

export function PriceSlider({ spot }: { spot: number }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const { low, high } = useMemo(() => strikeRange(spot, side), [spot, side]);
  const strikes = useMemo(() => generateStrikes(low, high), [low, high]);
  const { trackSliderUse } = useSliderAnalytics();

  const [selectedStrike, setSelectedStrike] = useState<number>(() => defaultStrikeFor(spot, "buy"));
  const prevSideRef = useRef(side);

  // Reset to default only when side changes; otherwise just clamp to range
  useEffect(() => {
    if (prevSideRef.current !== side) {
      prevSideRef.current = side;
      setSelectedStrike(Math.max(low, Math.min(high, defaultStrikeFor(spot, side))));
    } else {
      setSelectedStrike((prev) => Math.max(low, Math.min(high, prev)));
    }
  }, [side, spot, low, high]);

  const { prices, loading } = usePrices(undefined, 60_000);

  // Get premium: real MM quote if available, realistic estimate otherwise
  const premium = useMemo(() => {
    const quote = findMatchingQuote(prices, selectedStrike, side);
    if (quote) return Math.round(quote.premium);
    return estimatePremium(selectedStrike, side, spot);
  }, [prices, selectedStrike, side, spot]);

  const handleSliderChange = useCallback(
    (value: number) => {
      setSelectedStrike(value);
      trackSliderUse(value, side);
    },
    [side, trackSliderUse],
  );

  const handleSideChange = useCallback((newSide: "buy" | "sell") => {
    setSide(newSide);
  }, []);

  if (low >= high) return null;

  const distancePct = side === "buy"
    ? Math.round(((spot - selectedStrike) / spot) * 100)
    : Math.round(((selectedStrike - spot) / spot) * 100);

  return (
    <div className="space-y-8">
      {/* Side toggle */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex w-fit">
        <button
          onClick={() => handleSideChange("buy")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            side === "buy"
              ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I have USD
        </button>
        <button
          onClick={() => handleSideChange("sell")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            side === "sell"
              ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          I have ETH
        </button>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-[clamp(1.3rem,3vw,2rem)] text-[var(--bone)] font-light">
          I&apos;d {side} ETH at{" "}
          <span className="text-[var(--accent)] font-semibold font-mono transition-all duration-200">
            ${selectedStrike.toLocaleString()}
          </span>
          <span className="text-[var(--text-secondary)] text-base font-normal ml-2 transition-all duration-200">
            ({distancePct}% {side === "buy" ? "below" : "above"} spot)
          </span>
        </h2>
      </div>

      {/* Desktop slider */}
      <div className="hidden sm:block space-y-3">
        <input
          type="range"
          min={low}
          max={high}
          step={STRIKE_INTERVAL}
          value={selectedStrike}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          aria-label={`Strike price: $${selectedStrike.toLocaleString()}`}
          className="w-full accent-[var(--accent)] cursor-pointer"
          style={{ height: "8px" }}
        />
        <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
          <span>${low.toLocaleString()}</span>
          <span>${high.toLocaleString()}</span>
        </div>
      </div>

      {/* Mobile tappable pills */}
      <div className="sm:hidden">
        <div className="flex flex-wrap gap-2 justify-center">
          {strikes.map((strike) => {
            const isSelected = strike === selectedStrike;
            return (
              <button
                key={strike}
                onClick={() => handleSliderChange(strike)}
                className={`px-3 py-2 rounded-lg text-sm font-mono transition-all duration-150 min-w-[72px] ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--bg)] font-semibold shadow-lg shadow-[var(--accent)]/20"
                    : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40"
                }`}
              >
                ${strike.toLocaleString()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SimulationResult
          premium={premium}
          strike={selectedStrike}
          spot={spot}
          side={side}
          loading={loading}
        />
      </motion.div>
    </div>
  );
}
