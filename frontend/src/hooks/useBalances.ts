"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUnits, type Address } from "viem";
import { publicClient, ADDRESSES, ERC20_ABI, IS_XLAYER } from "@/lib/contracts";

interface Balances {
  usdRaw: bigint;
  /** Native ETH balance */
  ethRaw: bigint;
  /** WETH token balance */
  wethRaw: bigint;
  /** WBTC/LBTC token balance */
  wbtcRaw: bigint;
  /** MockOKB token balance (XLayer only) */
  okbRaw: bigint;
  usd: number;
  /** Native ETH as a number */
  eth: number;
  /** WETH token as a number */
  weth: number;
  /** WBTC/LBTC token as a number (8 decimals) */
  wbtc: number;
  /** OKB as a number (18 decimals) */
  okb: number;
  usdFormatted: string;
  /** Formatted native ETH balance */
  ethFormatted: string;
}

const ZERO: Balances = {
  usdRaw: BigInt(0),
  ethRaw: BigInt(0),
  wethRaw: BigInt(0),
  wbtcRaw: BigInt(0),
  okbRaw: BigInt(0),
  usd: 0,
  eth: 0,
  weth: 0,
  wbtc: 0,
  okb: 0,
  usdFormatted: "0",
  ethFormatted: "0.00",
};

export function useBalances(address: Address | undefined, pollInterval = 15_000) {
  const [balances, setBalances] = useState<Balances>(ZERO);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!address) {
      setBalances(ZERO);
      setLoading(false);
      return;
    }
    try {
      const mokbAddress = ADDRESSES.mokb;

      const [usdRaw, wethRaw, wbtcRaw, ethRaw, okbRaw] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: ADDRESSES.weth,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        IS_XLAYER
          ? BigInt(0)
          : publicClient.readContract({
              address: ADDRESSES.wbtc,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            }),
        publicClient.getBalance({ address }),
        mokbAddress
          ? publicClient.readContract({
              address: mokbAddress,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            })
          : BigInt(0),
      ]);

      const usd = Number(formatUnits(usdRaw, 6));
      const eth = Number(formatUnits(ethRaw, 18));
      const weth = Number(formatUnits(wethRaw, 18));
      const wbtc = Number(formatUnits(wbtcRaw, 8));
      const okb = Number(formatUnits(okbRaw, 18));

      setBalances({
        usdRaw,
        ethRaw,
        wethRaw,
        wbtcRaw,
        okbRaw,
        usd,
        eth,
        weth,
        wbtc,
        okb,
        usdFormatted: usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ethFormatted: eth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      });
    } catch (err) {
      console.error("[useBalances] Failed to fetch balances:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  // Listen for balance:refetch events from other components
  useEffect(() => {
    const handler = () => {
      refetch();
      for (const delay of [500, 1500, 3000, 6000]) {
        window.setTimeout(() => refetch(), delay);
      }
    };
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return { ...balances, loading, refetch };
}
