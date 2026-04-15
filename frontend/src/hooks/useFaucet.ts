"use client";

import { useState } from "react";
import type { Address } from "viem";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FaucetOpts {
  address: Address | undefined;
  onComplete?: () => void;
}

type FaucetResult =
  | { ok: true }
  | { ok: false; error: string };

export function useFaucet({ address, onComplete }: FaucetOpts) {
  const [minting, setMinting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callFaucet(
    url: string,
    body: Record<string, string>,
  ): Promise<FaucetResult> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail: string | undefined;
        try {
          const data = await res.json();
          detail = data.detail;
        } catch { /* non-JSON */ }
        return { ok: false, error: detail || `Faucet error (${res.status})` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async function mint() {
    if (!address) return;
    setMinting(true);
    setError(null);

    const result = await callFaucet(
      `${API_BASE}/faucet/xlayer`,
      { address },
    );

    if (result.ok) {
      setNotification(
        "You received OKB gas, 50 OKB, and 100,000 USDC on X Layer.",
      );
      setTimeout(() => setNotification(null), 5000);
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } else {
      setError(result.error);
    }

    setMinting(false);
  }

  return { mint, minting, notification, error };
}
