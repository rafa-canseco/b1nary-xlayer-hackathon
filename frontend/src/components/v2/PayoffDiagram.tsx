"use client";

import { fmtUsd } from "@/lib/utils";

export function PayoffDiagram({
  strike,
  premium,
  side,
  spot,
}: {
  strike: number;
  premium: number;
  side: "buy" | "sell";
  spot: number;
}) {
  // X axis: 70% to 130% of strike
  const xMin = strike * 0.7;
  const xMax = strike * 1.3;
  const xRange = xMax - xMin;

  const W = 300;
  const H = 180;
  const PAD_L = 40;
  const PAD_R = 10;
  const PAD_T = 20;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const toX = (price: number) => PAD_L + ((price - xMin) / xRange) * plotW;
  const strikeX = toX(strike);
  const spotX = toX(Math.max(xMin, Math.min(xMax, spot)));

  // For puts (buy side): green zone is above strike (OTM), red zone is below strike (ITM)
  // For calls (sell side): green zone is below strike (OTM), red zone is above strike (ITM)
  const greenLeft = side === "buy" ? strikeX : PAD_L;
  const greenRight = side === "buy" ? PAD_L + plotW : strikeX;
  const redLeft = side === "buy" ? PAD_L : strikeX;
  const redRight = side === "buy" ? strikeX : PAD_L + plotW;

  // Y axis labels
  const premiumY = PAD_T + plotH * 0.35;
  const zeroY = PAD_T + plotH * 0.7;

  // X axis tick marks (5 evenly spaced)
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const price = xMin + (xRange / 4) * i;
    return { price, x: toX(price) };
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs text-[var(--text-secondary)] mb-2">
        What happens at expiry
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Green zone (OTM — earn premium, collateral back) */}
        <rect
          x={Math.min(greenLeft, greenRight)}
          y={PAD_T}
          width={Math.abs(greenRight - greenLeft)}
          height={plotH}
          fill="var(--accent)"
          opacity={0.08}
        />

        {/* Red zone (ITM — order fills) */}
        <rect
          x={Math.min(redLeft, redRight)}
          y={PAD_T}
          width={Math.abs(redRight - redLeft)}
          height={plotH}
          fill="var(--danger)"
          opacity={0.08}
        />

        {/* Premium line (always positive) */}
        <line
          x1={PAD_L}
          y1={premiumY}
          x2={PAD_L + plotW}
          y2={premiumY}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text x={PAD_L - 4} y={premiumY + 3} textAnchor="end" fill="var(--accent)" fontSize={9} fontWeight={600}>
          +${fmtUsd(premium)}
        </text>

        {/* Strike vertical line */}
        <line
          x1={strikeX}
          y1={PAD_T}
          x2={strikeX}
          y2={PAD_T + plotH}
          stroke="var(--text-secondary)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={strikeX} y={PAD_T - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize={9}>
          ${strike.toLocaleString()}
        </text>

        {/* Current spot marker */}
        <polygon
          points={`${spotX},${PAD_T + plotH + 4} ${spotX - 4},${PAD_T + plotH + 12} ${spotX + 4},${PAD_T + plotH + 12}`}
          fill="var(--text)"
        />
        <text x={spotX} y={PAD_T + plotH + 22} textAnchor="middle" fill="var(--text)" fontSize={8} fontWeight={600}>
          now
        </text>

        {/* Zone labels */}
        <text
          x={(Math.min(greenLeft, greenRight) + Math.max(greenLeft, greenRight)) / 2}
          y={zeroY}
          textAnchor="middle"
          fill="var(--accent)"
          fontSize={9}
          fontWeight={500}
        >
          Earn ${fmtUsd(premium)}
        </text>
        <text
          x={(Math.min(greenLeft, greenRight) + Math.max(greenLeft, greenRight)) / 2}
          y={zeroY + 13}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize={8}
        >
          your money comes back
        </text>

        <text
          x={(Math.min(redLeft, redRight) + Math.max(redLeft, redRight)) / 2}
          y={zeroY}
          textAnchor="middle"
          fill="var(--danger)"
          fontSize={9}
          fontWeight={500}
        >
          {side === "buy" ? "Buy OKB" : "Sell OKB"}
        </text>
        <text
          x={(Math.min(redLeft, redRight) + Math.max(redLeft, redRight)) / 2}
          y={zeroY + 13}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize={8}
        >
          + keep ${fmtUsd(premium)}
        </text>

        {/* X axis */}
        <line
          x1={PAD_L}
          y1={PAD_T + plotH}
          x2={PAD_L + plotW}
          y2={PAD_T + plotH}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {xTicks.map(({ price, x }) => (
          <text key={price} x={x} y={PAD_T + plotH + 12} textAnchor="middle" fill="var(--text-secondary)" fontSize={8}>
            ${Math.round(price).toLocaleString()}
          </text>
        ))}

        {/* Y axis label */}
        <text x={PAD_L - 4} y={PAD_T + plotH + 3} textAnchor="end" fill="var(--text-secondary)" fontSize={8}>
          $0
        </text>
      </svg>
    </div>
  );
}
