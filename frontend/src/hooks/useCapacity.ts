"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Capacity } from "@/lib/api";

export function useCapacity(asset?: string, pollInterval = 30_000) {
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getCapacity(asset);
      setCapacity(data);
    } catch {
      // Keep last known value on error — don't flip market to "closed"
      // on a transient network failure.
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { capacity, loading };
}
