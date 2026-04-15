import { type Address, type Chain, createPublicClient, http } from "viem";

const xlayerTestnet: Chain = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/web3/explorer/xlayer-test",
    },
  },
  testnet: true,
};

export const CHAIN = xlayerTestnet;

// Static access required — Webpack only inlines process.env.NEXT_PUBLIC_*
// when the key is a string literal, not a dynamic variable.
const ADDRESS_ENV = {
  NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS:    process.env.NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS,
  NEXT_PUBLIC_CONTROLLER_ADDRESS:     process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS,
  NEXT_PUBLIC_MARGIN_POOL_ADDRESS:    process.env.NEXT_PUBLIC_MARGIN_POOL_ADDRESS,
  NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS,
  NEXT_PUBLIC_ORACLE_ADDRESS:         process.env.NEXT_PUBLIC_ORACLE_ADDRESS,
  NEXT_PUBLIC_WHITELIST_ADDRESS:      process.env.NEXT_PUBLIC_WHITELIST_ADDRESS,
  NEXT_PUBLIC_BATCH_SETTLER_ADDRESS:  process.env.NEXT_PUBLIC_BATCH_SETTLER_ADDRESS,
  NEXT_PUBLIC_USDC_ADDRESS:           process.env.NEXT_PUBLIC_USDC_ADDRESS,
  NEXT_PUBLIC_WETH_ADDRESS:           process.env.NEXT_PUBLIC_WETH_ADDRESS,
  NEXT_PUBLIC_WBTC_ADDRESS:           process.env.NEXT_PUBLIC_WBTC_ADDRESS,
} as const;

const REQUIRED_KEYS = Object.keys(ADDRESS_ENV) as (keyof typeof ADDRESS_ENV)[];
const isAddr = (v: string | undefined): v is string =>
  !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

const missing = REQUIRED_KEYS.filter((k) => !isAddr(ADDRESS_ENV[k]));

if (missing.length > 0) {
  throw new Error(
    `[contracts] Missing or invalid contract address env vars: ${missing.join(", ")}. ` +
      "Add them to .env.local or Vercel environment settings.",
  );
}

export const ADDRESSES = {
  addressBook:   ADDRESS_ENV.NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS   as Address,
  controller:    ADDRESS_ENV.NEXT_PUBLIC_CONTROLLER_ADDRESS     as Address,
  marginPool:    ADDRESS_ENV.NEXT_PUBLIC_MARGIN_POOL_ADDRESS    as Address,
  oTokenFactory: ADDRESS_ENV.NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS as Address,
  oracle:        ADDRESS_ENV.NEXT_PUBLIC_ORACLE_ADDRESS         as Address,
  whitelist:     ADDRESS_ENV.NEXT_PUBLIC_WHITELIST_ADDRESS      as Address,
  batchSettler:  ADDRESS_ENV.NEXT_PUBLIC_BATCH_SETTLER_ADDRESS  as Address,
  usdc:          ADDRESS_ENV.NEXT_PUBLIC_USDC_ADDRESS           as Address,
  weth:          ADDRESS_ENV.NEXT_PUBLIC_WETH_ADDRESS           as Address,
  wbtc:          ADDRESS_ENV.NEXT_PUBLIC_WBTC_ADDRESS           as Address,
  mokb:          (process.env.NEXT_PUBLIC_MOKB_ADDRESS || null)  as Address | null,
  swapRouter:    (process.env.NEXT_PUBLIC_SWAP_ROUTER_ADDRESS || null) as Address | null,
} as const;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
if (!rpcUrl) {
  console.error(
    "[contracts] NEXT_PUBLIC_RPC_URL is not set. Falling back to the default public RPC, " +
      "which is rate-limited and unsuitable for production.",
  );
}

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(rpcUrl),
});

// Minimal ABIs — only the functions the frontend needs to call/read

export const WETH_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const OTOKEN_ABI = [
  {
    type: "function",
    name: "strikePrice",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "expiry",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPut",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "underlying",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateralAsset",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  ...ERC20_ABI,
] as const;

export const CONTROLLER_ABI = [
  {
    type: "function",
    name: "getVault",
    inputs: [
      { name: "owner", type: "address" },
      { name: "vaultId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "shortOtoken", type: "address" },
          { name: "shortAmount", type: "uint256" },
          { name: "collateralAsset", type: "address" },
          { name: "collateralAmount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vaultCount",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const BATCH_SETTLER_ABI = [
  {
    type: "function",
    name: "executeOrder",
    inputs: [
      {
        name: "quote",
        type: "tuple",
        components: [
          { name: "oToken", type: "address" },
          { name: "bidPrice", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "quoteId", type: "uint256" },
          { name: "maxAmount", type: "uint256" },
          { name: "makerNonce", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
      { name: "amount", type: "uint256" },
      { name: "collateral", type: "uint256" },
    ],
    outputs: [{ name: "vaultId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "exactOutputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

