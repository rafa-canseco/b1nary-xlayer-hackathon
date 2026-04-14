const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type OptionType = "call" | "put";

export interface PriceQuote {
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  expiry_date: string;
  premium: number;
  delta: number;
  iv: number;
  spot: number;
  ttl: number;
  expires_at: number;
  available_amount: number;
  otoken_address: string | null;
  signature: string | null;
  mm_address: string | null;
  bid_price_raw: number | null;
  deadline: number | null;
  quote_id: string | null;
  max_amount_raw: number | null;
  maker_nonce: number | null;
  position_count: number;
  chain: "base" | "solana" | "xlayer";
}

export interface Position {
  id: string;
  tx_hash: string;
  tx_url?: string | null;
  explorer_url?: string | null;
  block_number: number;
  user_address: string;
  otoken_address: string;
  amount: number;
  premium: string;
  collateral: number;
  vault_id: number;
  /** Legacy raw strike. Base uses 8 decimals; newer APIs may also send normalized fields below. */
  strike_price: number;
  /** Normalized strike in USD, preferred when provided by the backend. */
  strike_usd?: number | null;
  /** Alias for strike_usd used by some indexer responses. */
  strike?: number | null;
  expiry: number;
  is_put: boolean;
  is_settled: boolean;
  settled_at: string | null;
  settlement_tx_hash: string | null;
  settlement_tx_url?: string | null;
  indexed_at: string;
  settlement_type: string | null;
  delivered_asset: string | null;
  delivered_amount: number | null;
  delivery_tx_hash: string | null;
  delivery_tx_url?: string | null;
  is_itm: boolean | null;
  expiry_price: number | null;
  /** Normalized settlement price in USD, preferred when provided by the backend. */
  expiry_price_usd?: number | null;
  /** Optional raw collateral decimals from the backend for chain-specific assets. */
  collateral_decimals?: number | null;
  gross_premium: string;
  net_premium: string;
  protocol_fee: string;
  outcome: string | null;
  /** Asset slug (e.g. "eth", "btc"). May be absent on older rows. */
  asset?: string;
  /** UUID linking range (put+call) pairs. Null for single-leg positions. */
  group_id?: string | null;
}

export interface SimulateResult {
  premium_earned: number;
  was_assigned: boolean;
  eth_low_of_week: number;
  eth_close: number;
  comparison: {
    hold_return: number;
    stake_return: number;
    dca_return: number;
  };
}

export interface LeaderboardMe {
  wallet: string;
  position_count: number;
  total_collateral_usd: number;
  total_earned_usd: number;
  earning_rate: number | null;
  active_days: number;
  wheel_count: number;
  otm_streak: number;
  qualifies: boolean;
}

export interface LeaderboardProgress {
  collateral_pct: number;
  days_pct: number;
}

export interface LeaderboardTrack1Entry {
  rank: number | null;
  wallet: string;
  qualified: boolean;
  progress: LeaderboardProgress;
  earning_rate: number | null;
  total_earned_usd: number;
  total_collateral_usd: number;
  position_count: number;
  wheel_count: number;
  active_days: number;
}

export interface LeaderboardTrack2Entry {
  rank: number | null;
  wallet: string;
  qualified: boolean;
  progress: LeaderboardProgress;
  otm_streak: number;
  position_count: number;
  earning_rate: number | null;
}

export interface LeaderboardMeta {
  competition_start: number;
  competition_end: number;
  total_participants: number;
  qualified_participants: number;
  total_volume_usd: number;
  current_week: number;
}

export interface Leaderboard {
  track1: LeaderboardTrack1Entry[];
  track2: LeaderboardTrack2Entry[];
  meta: LeaderboardMeta;
}

export interface YieldAssetSummary {
  asset: string;
  pending_raw: number;
  pending: number;
  delivered_raw: number;
  delivered: number;
  estimated_accruing_raw: number;
  estimated_accruing: number;
  total_raw: number;
  total: number;
}

export interface YieldUserSummary {
  wallet: string;
  assets: YieldAssetSummary[];
}

export interface YieldPosition {
  id: string;
  vault_id: number;
  asset: string;
  collateral_amount: number;
  deposited_at: string;
  settled_at: string | null;
  is_active: boolean;
  estimated_yield: number;
  estimated_yield_raw: number;
}

export interface YieldPositionTotal {
  asset: string;
  estimated_yield: number;
}

export interface YieldUserPositions {
  wallet: string;
  positions: YieldPosition[];
  totals: YieldPositionTotal[];
}

export interface YieldDistribution {
  id: string;
  distribution_id: string;
  asset: string;
  amount_raw: number;
  amount: number;
  status: "pending" | "delivered";
  airdrop_tx_hash: string | null;
  created_at: string;
}

export interface YieldUserHistory {
  wallet: string;
  history: YieldDistribution[];
}

export interface YieldStatsAsset {
  asset: string;
  total_yield_raw: number;
  total_yield: number;
  total_fees_raw: number;
  total_fees: number;
  total_distributed: number;
  distributions: number;
  current_accrued_raw: number;
  current_accrued: number;
}

export interface YieldStats {
  assets: YieldStatsAsset[];
}

export interface Activity {
  totalVolume: number;
  totalPremiumEarned: number;
  totalPremiumUsd: number;
  totalCollateralUsd: number;
  earningRate: number;
  positionCount: number;
  activeDays: number;
  daysSinceFirst: number;
}

export interface Capacity {
  capacity: number;
  capacity_usd: number;
  market_open: boolean;
  market_status: "active" | "degraded" | "full";
  max_position: number;
  mm_count: number;
  updated_at: string;
}

export interface SpotPrice {
  asset: string;
  spot: number;
  updated_at: number;
}

export interface AnalyticsEvent {
  session_id: string;
  event_type: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bridge types (B1N-260 — aligned with backend relayer API)
// ---------------------------------------------------------------------------

export type BridgeJobStatus =
  | "pending"
  | "attesting"
  | "minting"
  | "trading"
  | "completed"
  | "mint_completed"
  | "failed"
  | "mint_completed_trade_failed";

export interface BridgeAndTradeRequest {
  burnTxHash: string;
  sourceChain: "base" | "solana";
  destChain: "base" | "solana";
  userId: string;
  mintRecipient: string;
  burnAmount: string;
  quoteId: string;
  signedTradeTx: string | null;
}

export interface BridgeJob {
  id: string;
  status: BridgeJobStatus;
  source_chain: "base" | "solana";
  dest_chain: "base" | "solana";
  burn_tx_hash: string;
  burn_amount: string;
  mint_recipient: string;
  quote_id: string;
  mint_tx_hash: string | null;
  trade_tx_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}



async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getPrices: (asset?: string) =>
    fetchAPI<PriceQuote[]>(asset ? `/prices?asset=${asset}` : "/prices"),

  getPositions: (address: string) =>
    fetchAPI<Position[]>(`/positions/${address}`),

  joinWaitlist: (email: string) =>
    fetchAPI<{ ok: boolean; new: boolean }>("/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  simulate: (strike: number, side: "buy" | "sell") =>
    fetchAPI<SimulateResult>(`/prices/simulate?strike=${strike}&side=${side}`),

  trackEvent: (event: AnalyticsEvent) =>
    fetchAPI<{ ok: boolean }>("/analytics/event", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  getWaitlistCount: () =>
    fetchAPI<{ count: number }>("/waitlist/count"),

  getActivity: (address: string, alsoAddress?: string) =>
    fetchAPI<Activity>(
      alsoAddress
        ? `/activity/${address}?also=${alsoAddress}`
        : `/activity/${address}`,
    ),

  getCapacity: (asset?: string) =>
    fetchAPI<Capacity>(asset ? `/capacity?asset=${asset}` : "/capacity"),

  getSpot: (asset: string) =>
    fetchAPI<SpotPrice>(`/spot?asset=${asset}`),

  groupPositions: (groupId: string, txHashes: string[], userAddress: string) =>
    fetchAPI<{ grouped: number; group_id: string }>("/positions/group", {
      method: "POST",
      body: JSON.stringify({
        group_id: groupId,
        tx_hashes: txHashes,
        user_address: userAddress,
      }),
    }),

  getNotificationStatus: (wallet: string) =>
    fetchAPI<{ has_email: boolean; verified: boolean; unsubscribed: boolean }>(
      `/notifications/status?wallet=${wallet}`,
    ),

  submitEmail: (wallet: string, email: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/email", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet, email }),
    }),

  verifyCode: (wallet: string, code: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/verify", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet, code }),
    }),

  unsubscribe: (wallet: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet }),
    }),

  getLeaderboard: (start: number, end: number) =>
    fetchAPI<Leaderboard>(`/leaderboard?start=${start}&end=${end}`),

  getLeaderboardMe: (address: string, start: number, end: number) =>
    fetchAPI<LeaderboardMe>(
      `/leaderboard/me?address=${address}&start=${start}&end=${end}`,
    ),

  getYieldSummary: (address: string) =>
    fetchAPI<YieldUserSummary>(`/yield/user/${address}`),

  getYieldPositions: (address: string) =>
    fetchAPI<YieldUserPositions>(`/yield/user/${address}/positions`),

  getYieldHistory: (address: string) =>
    fetchAPI<YieldUserHistory>(`/yield/user/${address}/history`),

  getYieldStats: () =>
    fetchAPI<YieldStats>("/yield/stats"),

  // Bridge (B1N-260)
  bridgeAndTrade: (params: BridgeAndTradeRequest) =>
    fetchAPI<{ job_id: string; status: string }>("/api/bridge-and-trade", {
      method: "POST",
      body: JSON.stringify({
        burn_tx_hash: params.burnTxHash,
        source_chain: params.sourceChain,
        dest_chain: params.destChain,
        user_id: params.userId,
        mint_recipient: params.mintRecipient,
        burn_amount: params.burnAmount,
        quote_id: params.quoteId,
        signed_trade_tx: params.signedTradeTx,
      }),
    }),

  getBridgeStatus: (jobId: string) =>
    fetchAPI<BridgeJob>(`/api/bridge-status/${jobId}`),

};
