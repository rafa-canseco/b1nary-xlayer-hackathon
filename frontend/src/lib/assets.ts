import { normalizeUsdPrice } from "@/lib/positionMath";
import { IS_XLAYER } from "@/lib/contracts";

export interface AssetConfig {
  slug: string;
  symbol: string;
  name: string;
  /** Wrapped token symbol used as collateral for calls */
  wrappedSymbol: string;
  /** Stable token symbol used as collateral for puts */
  stableSymbol: string;
  /** Max amount for the amount input (in asset units, for sells) */
  maxAmount: number;
  /** Max amount in USD (for buys) */
  maxAmountUsd: number;
  /** Placeholder for the amount input (sell side) */
  amountPlaceholder: string;
  /** Number of decimals to show for the asset */
  displayDecimals: number;
  /** If true, asset is shown in selector but not tradeable yet */
  comingSoon?: boolean;
  /** Uniswap V3 fee tier for USDC↔asset swaps. Must match on-chain config. */
  swapFeeTier?: number;
  /** Minimum sell amount in asset units (e.g. 0.005 ETH) */
  minSellAmount: number;
  /** Minimum buy amount in USD */
  minBuyAmountUsd: number;
  /** Which chain this asset trades on */
  chain: "base" | "solana" | "xlayer";
  /** Decimals of the wrapped collateral token for calls */
  collateralDecimals: number;
}

export const ASSETS: Record<string, AssetConfig> = {
  eth: {
    slug: "eth",
    symbol: "ETH",
    name: "Ethereum",
    wrappedSymbol: "WETH",
    stableSymbol: "USDC",
    maxAmount: 1_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.5",
    displayDecimals: 4,
    swapFeeTier: 3000,
    minSellAmount: 0.005,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
  },
  btc: {
    slug: "btc",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    wrappedSymbol: "cbBTC",
    stableSymbol: "USDC",
    maxAmount: 100,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.01",
    displayDecimals: 6,
    swapFeeTier: 500,
    minSellAmount: 0.0001,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
  },
  sol: {
    slug: "sol",
    symbol: "SOL",
    name: "Solana",
    wrappedSymbol: "wSOL",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 9,
  },
  okb: {
    slug: "okb",
    symbol: "OKB",
    name: "OKB",
    wrappedSymbol: "MockOKB",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    swapFeeTier: 500,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "xlayer",
    collateralDecimals: 18,
  },
};

export const ASSET_SLUGS = Object.keys(ASSETS);
export const DEFAULT_ASSET = IS_XLAYER ? "okb" : "eth";

if (!(DEFAULT_ASSET in ASSETS)) {
  throw new Error(
    `DEFAULT_ASSET "${DEFAULT_ASSET}" not found in ASSETS registry`
  );
}

export function getAssetConfig(slug: string): AssetConfig | undefined {
  return ASSETS[slug.toLowerCase()];
}

/**
 * Resolve asset config for a position.
 * Uses the backend `asset` field when available, falls back to
 * inferring from strike price (BTC > $10k, ETH below).
 */
export function resolvePositionAsset(
  asset?: string,
  strikePrice?: number,
): AssetConfig {
  if (asset) {
    const config = ASSETS[asset.toLowerCase()];
    if (config) return config;
  }
  if (strikePrice != null) {
    const strikeUsd = normalizeUsdPrice(strikePrice);
    if (strikeUsd > 10_000) return ASSETS.btc;
    if (strikeUsd < 500) return ASSETS.sol;
    return ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET];
}
