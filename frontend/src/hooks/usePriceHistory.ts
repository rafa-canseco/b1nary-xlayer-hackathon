"use client";

import { useState, useEffect } from "react";

export interface PricePoint {
  time: number;
  price: number;
}

export function usePriceHistory(spot: number | undefined, maxPoints = 100) {
  const [history, setHistory] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (spot === undefined) return;
    setHistory((prev) => {
      const next = [...prev, { time: Date.now(), price: spot }];
      return next.length > maxPoints ? next.slice(-maxPoints) : next;
    });
  }, [spot, maxPoints]);

  return history;
}
