"use client";

import { useState, useMemo, useCallback } from "react";
import type { Position } from "@/lib/api";
import { fmtUsd } from "@/lib/utils";

type Period = "1M" | "3M" | "ALL";
const PERIODS: Period[] = ["1M", "3M", "ALL"];

// Hardcode chart colors — shadcn overrides var(--accent) to near-white
const ACCENT = "#22D3EE";
const ACCENT_FILL_TOP = "rgba(34, 211, 238, 0.25)";
const ACCENT_FILL_BOT = "rgba(34, 211, 238, 0.02)";
const DANGER = "#EF4444";
const GRID = "#27272A";
const TEXT_SEC = "#A1A1AA";
const FONT_MONO = "'JetBrains Mono', monospace";

interface ChartPoint {
  date: Date;
  label: string;
  cumulative: number;
  delta: number;
  isAssignment: boolean;
}

interface Props {
  positions: Position[];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${fmtUsd(value)}`;
}

function buildChartData(positions: Position[]): ChartPoint[] {
  // Sort by indexed_at (oldest first)
  const sorted = [...positions].sort(
    (a, b) => new Date(a.indexed_at).getTime() - new Date(b.indexed_at).getTime(),
  );

  const points: ChartPoint[] = [];
  let cumulative = 0;

  for (const pos of sorted) {
    const premium = Number(pos.net_premium) / 1e6;
    cumulative += premium;
    const date = new Date(pos.indexed_at);

    points.push({
      date,
      label: formatDate(date),
      cumulative,
      delta: premium,
      isAssignment: pos.is_itm === true,
    });
  }

  return points;
}

export function EarningsChart({ positions }: Props) {
  const [period, setPeriod] = useState<Period>("ALL");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const allPoints = useMemo(() => buildChartData(positions), [positions]);

  const filtered = useMemo(() => {
    if (period === "ALL") return allPoints;
    const daysBack = period === "1M" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const subset = allPoints.filter((p) => p.date >= cutoff);
    // If period filter removes everything, show all
    return subset.length > 0 ? subset : allPoints;
  }, [allPoints, period]);

  // Prepend $0 origin so line starts from zero
  const points = useMemo(() => {
    if (filtered.length === 0) return [];
    const originDate = new Date(filtered[0].date);
    originDate.setDate(originDate.getDate() - 1);
    return [
      { date: originDate, label: formatDate(originDate), cumulative: 0, delta: 0, isAssignment: false },
      ...filtered,
    ];
  }, [filtered]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length <= 1) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const idx = Math.round(ratio * (points.length - 1));
      setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
    },
    [points.length],
  );

  if (positions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center space-y-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Earnings will appear after your first settled position
        </p>
        <p className="text-xs text-[var(--text-secondary)] opacity-60">
          Your cumulative earnings chart will show here
        </p>
      </div>
    );
  }

  if (points.length < 2) return null;

  // Chart dimensions
  const W = 480;
  const H = 220;
  const PAD_T = 24;
  const PAD_B = 32;
  const PAD_L = 48;
  const PAD_R = 16;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const values = points.map((p) => p.cumulative);
  const maxVal = Math.max(...values);
  const yMax = maxVal + maxVal * 0.12 || 1;
  const yMin = 0;
  const yRange = yMax - yMin;

  const toX = (i: number) =>
    PAD_L + (i / (points.length - 1)) * plotW;
  const toY = (val: number) => PAD_T + (1 - (val - yMin) / yRange) * plotH;

  // Smooth curve via cardinal spline
  const linePoints = points.map((p, i) => ({ x: toX(i), y: toY(p.cumulative) }));

  let linePath = `M${linePoints[0].x},${linePoints[0].y}`;
  if (linePoints.length === 2) {
    linePath += ` L${linePoints[1].x},${linePoints[1].y}`;
  } else {
    // Catmull-Rom to cubic bezier
    for (let i = 0; i < linePoints.length - 1; i++) {
      const p0 = linePoints[Math.max(0, i - 1)];
      const p1 = linePoints[i];
      const p2 = linePoints[i + 1];
      const p3 = linePoints[Math.min(linePoints.length - 1, i + 2)];
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      linePath += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
  }

  const baselineY = toY(0);
  const lastPt = linePoints[linePoints.length - 1];
  const firstPt = linePoints[0];
  const areaPath = `${linePath} L${lastPt.x},${baselineY} L${firstPt.x},${baselineY} Z`;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + (yRange * i) / (tickCount - 1);
    return { val, y: toY(val) };
  });

  // X-axis labels
  const maxLabels = Math.min(6, points.length);
  const xLabels = Array.from({ length: maxLabels }, (_, i) => {
    const idx = Math.round((i / (maxLabels - 1)) * (points.length - 1));
    return { label: points[idx].label, x: toX(idx) };
  });

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const hoveredReal = hovered && hoverIdx !== 0 ? hovered : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]" style={{ color: TEXT_SEC }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: ACCENT }} />
            Cumulative earnings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: DANGER }} />
            Assignment
          </span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setHoverIdx(null); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors duration-150"
              style={{
                background: period === p ? "rgba(34, 211, 238, 0.15)" : "transparent",
                color: period === p ? ACCENT : TEXT_SEC,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <div className="h-5">
        {hoveredReal ? (
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: TEXT_SEC }}>{hoveredReal.label}</span>
            <span className="font-mono font-semibold" style={{ color: ACCENT }}>
              {formatUsd(hoveredReal.cumulative)}
            </span>
            <span
              className="font-mono text-[10px]"
              style={{ color: hoveredReal.delta >= 0 ? ACCENT : DANGER }}
            >
              {hoveredReal.delta >= 0 ? "+" : ""}
              {formatUsd(hoveredReal.delta)}
            </span>
            {hoveredReal.isAssignment && (
              <span className="text-[10px] font-medium" style={{ color: DANGER }}>
                Assigned
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs opacity-60" style={{ color: TEXT_SEC }}>
            Hover to see details per position
          </p>
        )}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minHeight: 180 }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_FILL_TOP} />
            <stop offset="100%" stopColor={ACCENT_FILL_BOT} />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke={GRID} strokeWidth={0.5} />
            <text
              x={PAD_L - 8} y={t.y + 3} textAnchor="end" fill={TEXT_SEC}
              fontSize={9} style={{ fontFamily: FONT_MONO }}
            >
              {formatUsd(t.val)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i} x={l.x} y={H - 8} textAnchor="middle" fill={TEXT_SEC}
            fontSize={8} style={{ fontFamily: FONT_MONO }}
          >
            {l.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#earningsGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => {
          const cx = toX(i);
          const cy = toY(p.cumulative);
          const isHovered = hoverIdx === i;
          const isOrigin = i === 0;

          if (isOrigin) return null;

          return (
            <g key={i}>
              {isHovered && (
                <line
                  x1={cx} y1={PAD_T} x2={cx} y2={PAD_T + plotH}
                  stroke={TEXT_SEC} strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4}
                />
              )}
              {p.isAssignment && (
                <circle cx={cx} cy={cy} r={isHovered ? 7 : 5} fill={DANGER} opacity={0.25} />
              )}
              <circle
                cx={cx} cy={cy}
                r={isHovered ? 5 : p.isAssignment ? 3.5 : 2.5}
                fill={p.isAssignment ? DANGER : ACCENT}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
