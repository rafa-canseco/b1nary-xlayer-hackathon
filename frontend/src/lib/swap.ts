import { encodeFunctionData, type Address } from "viem";
import { SWAP_ROUTER_ABI } from "@/lib/contracts";

/**
 * Encode a Uniswap V3 exactInputSingle swap.
 * Used to convert USDC → WETH/cbBTC when user lacks collateral for call side.
 */
export function encodeSwapExactInput(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: BigInt(0),
    }],
  });
}

/**
 * Encode a Uniswap V3 exactOutputSingle swap.
 * Swaps exactly `amountOut` of tokenOut, spending at most `amountInMaximum` of tokenIn.
 */
export function encodeSwapExactOutput(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  amountOut: bigint,
  amountInMaximum: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactOutputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient,
      amountOut,
      amountInMaximum,
      sqrtPriceLimitX96: BigInt(0),
    }],
  });
}

/**
 * Compute minimum output for a USDC input, with slippage protection.
 * @param amountInUsdc - USDC amount in raw units (6 decimals)
 * @param spotPrice - USD per asset unit (e.g. 2045.50 for ETH, 84000 for BTC)
 * @param slippageBps - Slippage tolerance in basis points (e.g. 50 = 0.5%)
 * @param outDecimals - Output token decimals (18 for WETH, 8 for cbBTC)
 * @returns Minimum output amount in raw units
 */
export function computeMinAmountOut(
  amountInUsdc: bigint,
  spotPrice: number,
  slippageBps = 50,
  outDecimals = 18,
): bigint {
  const usdcFloat = Number(amountInUsdc) / 1e6;
  const expectedUnits = usdcFloat / spotPrice;
  const expectedRaw = BigInt(Math.floor(expectedUnits * (10 ** outDecimals)));
  return (expectedRaw * BigInt(10000 - slippageBps)) / BigInt(10000);
}
