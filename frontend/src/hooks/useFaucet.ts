"use client";

import { useState } from "react";
import { IS_XLAYER } from "@/lib/contracts";
import type { Address } from "viem";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FaucetOpts {
  address: Address | undefined;
  solanaAddress: string | undefined;
  onComplete?: () => void;
}

type FaucetResult =
  | { ok: true }
  | { ok: false; error: string };

export function useFaucet({ address, solanaAddress, onComplete }: FaucetOpts) {
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
    if (!address && !solanaAddress) return;
    setMinting(true);
    setError(null);

    const results: string[] = [];
    const errors: string[] = [];

    if (IS_XLAYER) {
      if (!address) {
        setMinting(false);
        return;
      }
      const xlayerResult = await callFaucet(
        `${API_BASE}/faucet/xlayer`,
        { address },
      );
      if (xlayerResult.ok) {
        results.push("OKB gas, 50 OKB, and 100,000 USDC on X Layer");
      } else {
        errors.push(xlayerResult.error);
      }
    } else {
      const [baseResult, solanaResult] = await Promise.all([
        address
          ? callFaucet(`${API_BASE}/faucet`, { address })
          : null,
        solanaAddress
          ? callFaucet(`${API_BASE}/faucet/solana`, { address: solanaAddress })
          : null,
      ]);

      if (baseResult?.ok) {
        results.push("100,000 USDC, 50 ETH, and 2 BTC on Base");
      } else if (baseResult) {
        errors.push(baseResult.error);
      }

      if (solanaResult?.ok) {
        results.push("10,000 USDC and 0.1 SOL on Solana");
      } else if (solanaResult) {
        errors.push(solanaResult.error);
      }
    }

    if (results.length > 0) {
      setNotification(`You received ${results.join("; ")}.`);
      setTimeout(() => setNotification(null), 5000);
      window.dispatchEvent(new Event("balance:refetch"));
      await onComplete?.();
    } else {
      setError(errors[0] || "Failed to get test tokens.");
    }

    setMinting(false);
  }

  return { mint, minting, notification, error };
}
