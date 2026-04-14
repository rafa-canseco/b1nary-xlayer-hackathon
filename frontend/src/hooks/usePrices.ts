"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type PriceQuote } from "@/lib/api";

export function usePrices(asset?: string, pollInterval = 10_000) {
  const [prices, setPrices] = useState<PriceQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasDataRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getPrices(asset);
      setPrices(prev =>
        data.length === 0 && prev.length > 0 ? prev : data
      );
      if (data.length > 0) hasDataRef.current = true;
      setError(null);

      // First load returned empty: retry in 2s instead of waiting
      // the full poll interval. Covers the MM quote-refresh gap.
      if (data.length === 0 && !hasDataRef.current) {
        retryRef.current = setTimeout(refresh, 2_000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => {
      clearInterval(id);
      clearTimeout(retryRef.current);
    };
  }, [refresh, pollInterval]);

  return { prices, loading, error, refresh };
}
