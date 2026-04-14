"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function useSpot(asset: string, pollInterval = 10_000) {
  const [spot, setSpot] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSpot(asset);
      setSpot(data.spot);
    } catch {
      // Spot endpoint may not exist yet; fall silent
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { spot, loading };
}
