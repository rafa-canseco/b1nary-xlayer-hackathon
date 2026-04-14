"use client";

import { useState, useEffect, useRef } from "react";

export function TickingPrice({
  base,
  className = "",
  onPriceChange,
}: {
  base: number;
  className?: string;
  onPriceChange?: (price: number) => void;
}) {
  const [price, setPrice] = useState(base);
  const prevRef = useRef(base);
  const [display, setDisplay] = useState(base);
  const frameRef = useRef<number>(0);
  const [flash, setFlash] = useState(false);
  const onPriceChangeRef = useRef(onPriceChange);
  onPriceChangeRef.current = onPriceChange;

  // Simulate frequent price ticks with mean-reversion
  useEffect(() => {
    const scheduleTick = () => {
      const delay = 400 + Math.random() * 1200;
      return setTimeout(() => {
        setPrice((prev) => {
          const delta = (Math.random() - 0.5) * 3;
          const revert = (base - prev) * 0.02;
          return Math.round((prev + delta + revert) * 100) / 100;
        });
        timeoutId = scheduleTick();
      }, delay);
    };
    let timeoutId = scheduleTick();
    return () => clearTimeout(timeoutId);
  }, [base]);

  // Notify parent of price changes
  useEffect(() => {
    onPriceChangeRef.current?.(price);
  }, [price]);

  // Animate number transition + flash
  useEffect(() => {
    const from = prevRef.current;
    const to = price;
    prevRef.current = price;
    if (from === to) return;

    // Trigger flash
    setFlash(true);
    const flashTimeout = setTimeout(() => setFlash(false), 150);

    const duration = 300;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(flashTimeout);
    };
  }, [price]);

  return (
    <span
      className={className}
      style={{
        opacity: flash ? 0.5 : 1,
        transition: "opacity 0.15s ease-out",
      }}
    >
      ${display.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
    </span>
  );
}
