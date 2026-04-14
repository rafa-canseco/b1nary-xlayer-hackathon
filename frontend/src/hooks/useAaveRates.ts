"use client";

import { useState, useEffect } from "react";
import { type Address, createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Always read Aave rates from Base mainnet — rates are the same
// regardless of which environment (staging/production) the app runs on.
const AAVE_POOL: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";

// Mainnet token addresses for rate lookups
const MAINNET_USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MAINNET_WETH: Address = "0x4200000000000000000000000000000000000006";
const MAINNET_WBTC: Address = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

const mainnetClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ??
      "https://mainnet.base.org",
  ),
});

const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "getReserveData",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

const RAY = BigInt("1000000000000000000000000000");

const ASSET_MAP: Record<string, Address> = {
  usdc: MAINNET_USDC,
  eth: MAINNET_WETH,
  btc: MAINNET_WBTC,
};

export type AaveRates = Record<string, number>;

const FALLBACK_RATES: AaveRates = {
  usdc: 0.0274,
  eth: 0.0155,
  btc: 0.0003,
};

async function fetchRate(asset: Address): Promise<number> {
  const data = await mainnetClient.readContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "getReserveData",
    args: [asset],
  });
  return Number(data.currentLiquidityRate) / Number(RAY);
}

export function useAaveRates() {
  const [rates, setRates] = useState<AaveRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      Object.entries(ASSET_MAP).map(async ([slug, addr]) => {
        try {
          const rate = await fetchRate(addr);
          return [slug, rate] as const;
        } catch {
          return [slug, FALLBACK_RATES[slug] ?? 0] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const newRates: AaveRates = {};
      for (const [slug, rate] of results) {
        newRates[slug] = rate;
      }
      setRates(newRates);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { rates, loading };
}
