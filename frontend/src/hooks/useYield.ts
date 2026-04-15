"use client";

import { useState, useEffect, useCallback } from "react";
import {
  api,
  type YieldUserSummary,
  type YieldUserPositions,
  type YieldUserHistory,
  type YieldStats,
} from "@/lib/api";

interface YieldData {
  summary: YieldUserSummary | null;
  positions: YieldUserPositions | null;
  history: YieldUserHistory | null;
  stats: YieldStats | null;
}

export function useYield(address: string | undefined) {
  const [data, setData] = useState<YieldData>({
    summary: null,
    positions: null,
    history: null,
    stats: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setData({ summary: null, positions: null, history: null, stats: null });
      setLoading(false);
      return;
    }
    try {
      const [summary, positions, history, stats] = await Promise.all([
        api.getYieldSummary(address),
        api.getYieldPositions(address),
        api.getYieldHistory(address),
        api.getYieldStats(),
      ]);
      setData({ summary, positions, history, stats });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch yield data");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
