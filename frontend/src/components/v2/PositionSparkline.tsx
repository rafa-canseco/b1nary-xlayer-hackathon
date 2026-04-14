"use client";

import type { PricePoint } from "@/hooks/usePriceHistory";

export function PositionSparkline({
  priceHistory,
  strike,
  isPut,
}: {
  priceHistory: PricePoint[];
  strike: number;
  isPut: boolean;
}) {
  // Need at least 3 points for a meaningful sparkline
  if (priceHistory.length < 3) {
    return (
      <div className="mt-2 rounded-lg bg-[var(--surface)] p-2">
        <p className="text-[10px] text-[var(--text-secondary)] text-center">
          Collecting price data...
        </p>
      </div>
    );
  }

  const prices = priceHistory.map((p) => p.price);
  const allValues = [...prices, strike];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const W = 240;
  const H = 60;
  const PAD = 4;

  const toY = (price: number) =>
    PAD + (1 - (price - min) / range) * (H - PAD * 2);

  const strikeY = toY(strike);

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = toY(p);
    return `${x},${y}`;
  });

  const currentPrice = prices[prices.length - 1];
  const isAboveStrike = currentPrice > strike;

  // For puts: above strike = safe (green), below = danger (red)
  // For calls: below strike = safe (green), above = danger (red)
  const isSafe = isPut ? isAboveStrike : !isAboveStrike;
  const lineColor = isSafe ? "var(--accent)" : "var(--danger)";

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-[var(--text-secondary)]">
          Price since page opened
        </span>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {priceHistory.length} points
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: 60 }}>
        {/* Strike line */}
        <line
          x1={0}
          y1={strikeY}
          x2={W}
          y2={strikeY}
          stroke="var(--text-secondary)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />
        <text x={W - 2} y={strikeY - 3} textAnchor="end" fill="var(--text-secondary)" fontSize={8}>
          ${strike.toLocaleString()}
        </text>

        {/* Price line */}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price dot */}
        <circle
          cx={W}
          cy={toY(currentPrice)}
          r={3}
          fill={lineColor}
        />
      </svg>
    </div>
  );
}
