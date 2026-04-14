"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Position } from "@/lib/api";

export function usePositions(
  address: string | undefined,
  fundingAddress: string | undefined,
  solanaAddress?: string | undefined,
  pollInterval = 15_000,
) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address && !fundingAddress) {
      setPositions([]);
      setLoading(false);
      return;
    }
    try {
      // Fetch from both addresses, deduplicate by id
      const queries: Promise<Position[]>[] = [];
      if (address) queries.push(api.getPositions(address));
      if (fundingAddress && fundingAddress !== address) {
        queries.push(api.getPositions(fundingAddress));
      }
      if (solanaAddress) {
        queries.push(api.getPositions(solanaAddress));
      }

      const results = await Promise.all(queries);
      const merged = results.flat();

      const seen = new Set<string>();
      const deduped = merged.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      setPositions(deduped);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [address, fundingAddress, solanaAddress]);

  useEffect(() => {
    refresh();
    if (!address && !fundingAddress) return;

    // Poll faster for the first 30s after mount (new position may still be indexing)
    const fastPoll = setInterval(refresh, 3_000);
    const stopFastPoll = setTimeout(() => clearInterval(fastPoll), 30_000);
    const slowPoll = setInterval(refresh, pollInterval);

    return () => {
      clearInterval(fastPoll);
      clearTimeout(stopFastPoll);
      clearInterval(slowPoll);
    };
  }, [refresh, address, fundingAddress, pollInterval]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refresh]);

  return { positions, loading, error, refresh };
}
