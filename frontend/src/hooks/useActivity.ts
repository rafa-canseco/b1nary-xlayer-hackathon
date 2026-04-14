"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Activity } from "@/lib/api";

export function useActivity(
  address: string | undefined,
  alsoAddress?: string | undefined,
) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setActivity(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getActivity(address, alsoAddress);
      setActivity(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch activity");
    } finally {
      setLoading(false);
    }
  }, [address, alsoAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refresh]);

  return { activity, loading, error, refresh };
}
