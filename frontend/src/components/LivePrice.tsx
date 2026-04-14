"use client";

import { useState, useEffect, useRef } from "react";

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function LivePrice({ spot, className = "" }: { spot: number | undefined; className?: string }) {
  const prevSpot = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (spot === undefined) return;

    if (prevSpot.current !== undefined && prevSpot.current !== spot) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      prevSpot.current = spot;
      return () => clearTimeout(t);
    }
    prevSpot.current = spot;
  }, [spot]);

  if (spot === undefined) {
    return <div className={`h-14 w-48 animate-pulse rounded-xl bg-[var(--surface)] ${className}`} />;
  }

  return (
    <div className={className}>
      <p className={`text-2xl sm:text-4xl font-bold text-[var(--bone)] font-mono tabular-nums ${flash ? "price-flash" : ""}`}>
        <AnimatedNumber value={spot} prefix="$" />
      </p>
    </div>
  );
}
