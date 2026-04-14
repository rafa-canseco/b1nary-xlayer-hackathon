import {
  parseUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { publicClient, ADDRESSES, ERC20_ABI, BATCH_SETTLER_ABI } from "@/lib/contracts";
import { getAssetConfig } from "@/lib/assets";
import type { PriceQuote, Position } from "@/lib/api";

export function computeAPR(
  premium: number,
  strike: number,
  expiryDays: number,
): number {
  if (strike <= 0 || expiryDays <= 0) return 0;
  return (premium / strike) * (365 / expiryDays) * 100;
}

export function computeROI(
  premium: number,
  strike: number,
): number {
  if (strike <= 0) return 0;
  return (premium / strike) * 100;
}

export function truncate(value: number, decimals: number): string {
  const factor = 10 ** decimals;
  return (Math.floor(value * factor) / factor).toFixed(decimals);
}

export function computeCollateral(
  isBuy: boolean,
  amount: number,
  strike: number,
  assetSlug: string,
): { oTokenAmount: bigint; collateral: bigint; collateralAsset: Address } {
  if (isBuy) {
    const ethUnits = amount / strike;
    const oTokenAmount = parseUnits(truncate(ethUnits, 8), 8);
    const strikePrice8 = BigInt(Math.round(strike * 1e8));
    const collateral = (oTokenAmount * strikePrice8) / BigInt(1e10);
    return { oTokenAmount, collateral, collateralAsset: ADDRESSES.usdc };
  }
  const oTokenAmount = parseUnits(truncate(amount, 8), 8);
  const config = getAssetConfig(assetSlug);
  const scale = BigInt(10) ** BigInt((config?.collateralDecimals ?? 18) - 8);
  const collateral = oTokenAmount * scale;
  const collateralAsset =
    assetSlug === "btc" ? ADDRESSES.wbtc
    : assetSlug === "okb" ? (ADDRESSES.mokb ?? ADDRESSES.weth)
    : ADDRESSES.weth;
  return { oTokenAmount, collateral, collateralAsset };
}

export function readTokenBalance(token: Address, account: Address) {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  });
}

export function encodeExecuteOrder(
  quote: PriceQuote,
  oTokenAmount: bigint,
  collateral: bigint,
): `0x${string}` {
  const quoteTuple = {
    oToken: quote.otoken_address as Address,
    bidPrice: BigInt(quote.bid_price_raw!),
    deadline: BigInt(quote.deadline!),
    quoteId: BigInt(quote.quote_id!),
    maxAmount: BigInt(quote.max_amount_raw!),
    makerNonce: BigInt(quote.maker_nonce!),
  };
  return encodeFunctionData({
    abi: BATCH_SETTLER_ABI,
    functionName: "executeOrder",
    args: [
      quoteTuple,
      quote.signature! as `0x${string}`,
      oTokenAmount,
      collateral,
    ],
  });
}

export async function pollUntil(
  check: () => Promise<boolean>,
  label: string,
  intervalMs = 2000,
  maxAttempts = 60,
) {
  let consecutiveErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const done = await check();
      consecutiveErrors = 0;
      if (done) {
        console.log(`[execution] ${label} confirmed on-chain`);
        return;
      }
    } catch (err) {
      consecutiveErrors++;
      console.warn(
        `[execution] Poll failed for ${label} (attempt ${i + 1}):`,
        err,
      );
      if (consecutiveErrors >= 5) {
        throw new Error(
          "Lost connection while waiting for confirmation. " +
          "Your transaction may still be processing — " +
          "check your balance before retrying.",
        );
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    "Timed out waiting for confirmation. " +
    "Your transaction may still be processing — " +
    "check your balance before retrying.",
  );
}

export async function fireAndPoll(
  fire: () => Promise<unknown>,
  check: () => Promise<boolean>,
  label: string,
): Promise<string | null> {
  let hash: string | null = null;
  const txP = fire().then((h) => {
    hash = h as string;
  });
  const pollP = pollUntil(check, label);

  // Succeed if EITHER the tx hash returns OR the on-chain poll
  // confirms. Only fail if both fail.
  await Promise.any([txP, pollP]);

  // Suppress unhandled rejection from the loser
  txP.catch(() => {});
  pollP.catch(() => {});

  return hash;
}

export function buildOptimisticPosition(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  address: Address,
  assetSlug: string,
  groupId?: string,
): Position {
  const optOTokenAmt = isBuy
    ? (amount / quote.strike) * 1e8
    : amount * 1e8;
  const callDecimals = assetSlug === "btc" ? 1e8 : 1e18; // OKB and ETH are both 18 decimals
  const optCollateral = isBuy ? amount * 1e6 : amount * callDecimals;
  const optPremium = isBuy
    ? String(((quote.premium * amount) / quote.strike) * 1e6)
    : String(quote.premium * amount * 1e6);
  return {
    id: "opt-" + Date.now(),
    tx_hash: "",
    block_number: 0,
    user_address: address,
    otoken_address: quote.otoken_address!,
    amount: optOTokenAmt,
    premium: optPremium,
    collateral: optCollateral,
    vault_id: null as unknown as number,
    strike_price: quote.strike * 1e8,
    expiry: quote.expires_at,
    is_put: isBuy,
    is_settled: false,
    settled_at: null,
    settlement_tx_hash: null,
    indexed_at: new Date().toISOString(),
    settlement_type: null,
    delivered_asset: null,
    delivered_amount: null,
    delivery_tx_hash: null,
    is_itm: null,
    expiry_price: null,
    gross_premium: optPremium,
    net_premium: optPremium,
    protocol_fee: "0",
    outcome: null,
    group_id: groupId ?? null,
  };
}
