"use client";

import type { PriceQuote } from "@/lib/api";
import { fmtUsd } from "@/lib/utils";
import { computeAPR, computeROI } from "@/lib/execution";
import type { YieldMetric } from "../YieldToggle";

export function StrikeLadder({
  filteredPrices,
  spot,
  side,
  onSelect,
  yieldMetric = "apr",
}: {
  filteredPrices: PriceQuote[];
  spot: number;
  side: "buy" | "sell";
  onSelect: (quote: PriceQuote) => void;
  yieldMetric?: YieldMetric;
}) {
  if (filteredPrices.length === 0 || !spot) return null;

  const allPrices = [...filteredPrices.map((p) => p.strike), spot];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice || 1;

  // Add 10% padding on each side
  const paddedMin = minPrice - range * 0.1;
  const paddedMax = maxPrice + range * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const ROW_H = 44;
  const PADDING_Y = 30;
  const W = 360;
  const H = filteredPrices.length * ROW_H + PADDING_Y * 2 + ROW_H;

  const priceToY = (price: number) =>
    PADDING_Y + (1 - (price - paddedMin) / paddedRange) * (H - PADDING_Y * 2);

  const spotY = priceToY(spot);
  const accentColor = side === "buy" ? "var(--accent)" : "var(--danger)";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 animate-fade-in-up">
      <p className="text-xs text-[var(--text-secondary)] mb-2 px-1">
        {side === "buy" ? "Buy" : "Sell"} strikes vs current price
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: 320 }}
      >
        {/* Spot price line */}
        <line
          x1={60}
          y1={spotY}
          x2={W - 10}
          y2={spotY}
          stroke="var(--text-secondary)"
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.5}
        />
        <text
          x={56}
          y={spotY + 4}
          textAnchor="end"
          fill="var(--text)"
          fontSize={12}
          fontWeight={600}
        >
          ${spot.toLocaleString()}
        </text>
        <text
          x={W - 8}
          y={spotY - 6}
          textAnchor="end"
          fill="var(--text-secondary)"
          fontSize={10}
        >
          spot
        </text>

        {/* Strike bands */}
        {filteredPrices.map((q) => {
          const y = priceToY(q.strike);
          const apr = Math.round(computeAPR(q.premium, q.strike, q.expiry_days));
          const roi = computeROI(q.premium, q.strike);
          const yieldLabel = yieldMetric === "apr"
            ? `${apr}% APR`
            : `${roi.toFixed(1)}% ROI`;
          const earnRaw = q.premium * q.available_amount;
          const earn = fmtUsd(earnRaw);
          const disabled = !q.otoken_address || q.available_amount <= 0;

          return (
            <g
              key={`${q.strike}-${q.expiry_days}`}
              onClick={() => !disabled && onSelect(q)}
              style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              opacity={disabled ? 0.3 : 1}
            >
              {/* Strike line */}
              <line
                x1={60}
                y1={y}
                x2={W - 10}
                y2={y}
                stroke={accentColor}
                strokeWidth={2}
                opacity={0.6}
              />
              {/* Strike price label */}
              <text
                x={56}
                y={y + 4}
                textAnchor="end"
                fill={accentColor}
                fontSize={12}
                fontWeight={600}
              >
                ${q.strike.toLocaleString()}
              </text>
              {/* Earn + APR label */}
              <text
                x={W - 8}
                y={y - 6}
                textAnchor="end"
                fill="var(--text-secondary)"
                fontSize={10}
              >
                Earn ${earn} · {yieldLabel}
              </text>
              {/* Invisible wider click target */}
              <rect
                x={0}
                y={y - 16}
                width={W}
                height={32}
                fill="transparent"
              />
            </g>
          );
        })}

        {/* Distance indicators — dotted lines between spot and strikes */}
        {filteredPrices.map((q) => {
          const y = priceToY(q.strike);
          const midX = 36;
          return (
            <line
              key={`dist-${q.strike}`}
              x1={midX}
              y1={spotY}
              x2={midX}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          );
        })}
      </svg>
    </div>
  );
}
