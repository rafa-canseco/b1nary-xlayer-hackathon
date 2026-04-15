import { normalizeUsdPrice } from "@/lib/positionMath";

export interface AssetConfig {
  slug: string;
  symbol: string;
  name: string;
  wrappedSymbol: string;
  stableSymbol: string;
  maxAmount: number;
  maxAmountUsd: number;
  amountPlaceholder: string;
  displayDecimals: number;
  comingSoon?: boolean;
  swapFeeTier?: number;
  minSellAmount: number;
  minBuyAmountUsd: number;
  chain: "xlayer";
  collateralDecimals: number;
}

export const ASSETS: Record<string, AssetConfig> = {
  eth: {
    slug: "eth",
    symbol: "ETH",
    name: "OKB",
    wrappedSymbol: "WETH",
    stableSymbol: "USDC",
    maxAmount: 1_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.5",
    displayDecimals: 4,
    swapFeeTier: 3000,
    minSellAmount: 0.005,
    minBuyAmountUsd: 10,
    chain: "xlayer",
    collateralDecimals: 18,
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
export const DEFAULT_ASSET = "okb";

if (!(DEFAULT_ASSET in ASSETS)) {
  throw new Error(
    `DEFAULT_ASSET "${DEFAULT_ASSET}" not found in ASSETS registry`
  );
}

export function getAssetConfig(slug: string): AssetConfig | undefined {
  return ASSETS[slug.toLowerCase()];
}

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
    if (strikeUsd > 10_000) return ASSETS.eth;
    return ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET];
}
