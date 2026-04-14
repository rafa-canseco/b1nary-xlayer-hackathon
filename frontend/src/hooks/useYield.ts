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

function mergeAssetSummaries(summaries: YieldUserSummary[]): YieldUserSummary | null {
  if (summaries.length === 0) return null;
  const wallet = summaries[0]?.wallet ?? "";
  const byAsset = new Map<string, YieldUserSummary["assets"][number]>();
  for (const summary of summaries) {
    for (const asset of summary.assets) {
      const prev = byAsset.get(asset.asset);
      byAsset.set(asset.asset, prev ? {
        ...asset,
        pending_raw: prev.pending_raw + asset.pending_raw,
        pending: prev.pending + asset.pending,
        delivered_raw: prev.delivered_raw + asset.delivered_raw,
        delivered: prev.delivered + asset.delivered,
        estimated_accruing_raw: prev.estimated_accruing_raw + asset.estimated_accruing_raw,
        estimated_accruing: prev.estimated_accruing + asset.estimated_accruing,
        total_raw: prev.total_raw + asset.total_raw,
        total: prev.total + asset.total,
      } : asset);
    }
  }
  return { wallet, assets: Array.from(byAsset.values()) };
}

function mergeYieldPositions(all: YieldUserPositions[]): YieldUserPositions | null {
  if (all.length === 0) return null;
  const wallet = all[0]?.wallet ?? "";
  const positionsMap = new Map<string, YieldUserPositions["positions"][number]>();
  const totalsMap = new Map<string, YieldUserPositions["totals"][number]>();

  for (const entry of all) {
    for (const pos of entry.positions) {
      positionsMap.set(pos.id, pos);
    }
    for (const total of entry.totals) {
      const prev = totalsMap.get(total.asset);
      totalsMap.set(total.asset, {
        asset: total.asset,
        estimated_yield: (prev?.estimated_yield ?? 0) + total.estimated_yield,
      });
    }
  }

  return {
    wallet,
    positions: Array.from(positionsMap.values()),
    totals: Array.from(totalsMap.values()),
  };
}

function mergeYieldHistory(all: YieldUserHistory[]): YieldUserHistory | null {
  if (all.length === 0) return null;
  const wallet = all[0]?.wallet ?? "";
  const historyMap = new Map<string, YieldUserHistory["history"][number]>();
  for (const entry of all) {
    for (const item of entry.history) {
      historyMap.set(item.id, item);
    }
  }
  return { wallet, history: Array.from(historyMap.values()) };
}

export function useYield(
  address: string | undefined,
  solanaAddress?: string | undefined,
) {
  const [data, setData] = useState<YieldData>({
    summary: null,
    positions: null,
    history: null,
    stats: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const addresses = [address, solanaAddress].filter(
      (value, index, arr): value is string =>
        Boolean(value) && arr.indexOf(value) === index,
    );

    if (addresses.length === 0) {
      setData({ summary: null, positions: null, history: null, stats: null });
      setLoading(false);
      return;
    }
    try {
      const [summaries, positionsList, historyList, stats] = await Promise.all([
        Promise.all(addresses.map((addr) => api.getYieldSummary(addr))),
        Promise.all(addresses.map((addr) => api.getYieldPositions(addr))),
        Promise.all(addresses.map((addr) => api.getYieldHistory(addr))),
        api.getYieldStats(),
      ]);
      setData({
        summary: mergeAssetSummaries(summaries),
        positions: mergeYieldPositions(positionsList),
        history: mergeYieldHistory(historyList),
        stats,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch yield data");
    } finally {
      setLoading(false);
    }
  }, [address, solanaAddress]);

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
