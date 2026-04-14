"use client";

import { useState, useEffect } from "react";
import type { Position } from "@/lib/api";
import {
  getAllOptimistic,
  removeMatchingOptimistic,
} from "@/lib/optimisticPositions";

/** Merges optimistic positions with real backend positions, auto-reconciling matches. */
export function useOptimisticPositions(realPositions: Position[]): Position[] {
  const [optimistic, setOptimistic] = useState<Position[]>([]);

  useEffect(() => {
    setOptimistic(getAllOptimistic());
  }, []);

  // Reconcile: remove optimistic entries the backend has now indexed
  useEffect(() => {
    if (realPositions.length > 0 && optimistic.length > 0) {
      removeMatchingOptimistic(realPositions);
      setOptimistic(getAllOptimistic());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realPositions, optimistic.length]);

  // Merge: optimistic (not yet matched) first, then real
  return [
    ...optimistic.filter(
      (o) =>
        !realPositions.some(
          (p) =>
            p.otoken_address.toLowerCase() === o.otoken_address.toLowerCase() &&
            p.user_address.toLowerCase() === o.user_address.toLowerCase(),
        ),
    ),
    ...realPositions,
  ];
}
