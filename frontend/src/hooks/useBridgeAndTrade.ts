"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/hooks/useWallet";
import {
  api,
  type PriceQuote,
  type BridgeJob,
  type BridgeJobStatus,
} from "@/lib/api";
import { computeCollateral } from "@/lib/execution";
import {
  buildEvmBurnCalls,
  buildSolanaBurnTransaction,
  evmToBytes32,
  solanaToBytes32,
} from "@/lib/cctp";
import {
  buildEvmTradeCalls,
  buildSolanaTradeTransaction,
} from "@/lib/bridgeTx";
import { SOLANA_NATIVE_RESERVE_LAMPORTS, toPublicKey } from "@/lib/solana";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainId = "base" | "solana";

export interface DeficitResult {
  needsBridge: boolean;
  needsDeposit: boolean;
  sourceChain: ChainId | null;
  deficit: bigint;
}

export interface BridgeAndTradeResult {
  success: boolean;
  jobId?: string;
  chainExecuted?: ChainId;
  txHash?: string;
  error?: string;
}

// Terminal states — stop polling when we hit one of these
const TERMINAL_STATUSES: BridgeJobStatus[] = [
  "completed",
  "failed",
  "mint_completed",
  "mint_completed_trade_failed",
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Bridge-and-trade orchestration.
 *
 * **Base → Solana** (backend submits trade):
 *   1. Smart wallet burns USDC on Base (send)
 *   2. Solana wallet signs trade tx (no send)
 *   3. POST with signedTradeTx
 *   4. Poll until "completed"
 *
 * **Solana → Base** (frontend executes trade after mint):
 *   1. Solana wallet burns USDC (send)
 *   2. POST with signedTradeTx: null
 *   3. Poll until "mint_completed"
 *   4. Frontend: sendBatchTx(approve + executeOrder)
 */
export function useBridgeAndTrade() {
  const { user } = usePrivy();
  const {
    address,
    solanaAddress,
    sendBatchTx,
    signSolanaTransaction,
  } = useWallet();

  const checkDeficit = useCallback(
    (
      quote: PriceQuote,
      amount: number,
      isBuy: boolean,
      assetSlug: string,
      baseUsdcRaw: bigint,
      solanaUsdcRaw: bigint,
      solanaWsolRaw?: bigint,
      solanaSolRaw?: bigint,
    ): DeficitResult => {
      if (!quote.chain) {
        throw new Error(
          "Quote is missing the `chain` field. " +
            "This is a bug — all quotes must specify their chain.",
        );
      }

      const { collateral } = computeCollateral(
        isBuy, amount, quote.strike, assetSlug,
      );

      // Puts (buy side): USDC collateral — can bridge cross-chain
      if (isBuy) {
        // XLayer and Base both use the EVM USDC balance (baseUsdcRaw)
        const targetBalance =
          quote.chain === "solana" ? solanaUsdcRaw : baseUsdcRaw;

        if (targetBalance >= collateral) {
          return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
        }

        // XLayer has no bridge — if insufficient, just prompt deposit
        if (quote.chain === "xlayer") {
          return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - targetBalance };
        }

        const sourceChain: ChainId =
          quote.chain === "base" ? "solana" : "base";
        const sourceBalance =
          sourceChain === "base" ? baseUsdcRaw : solanaUsdcRaw;

        // Total across both chains still insufficient — user must deposit
        if (targetBalance + sourceBalance < collateral) {
          return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - targetBalance - sourceBalance };
        }

        const deficit = collateral - targetBalance;
        return { needsBridge: true, needsDeposit: false, sourceChain, deficit };
      }

      // Calls (sell side): wrapped asset collateral
      if (quote.chain === "solana") {
        // SOL calls: wSOL + wrappable native SOL. Keep a small native SOL
        // reserve for rent/account state; gas itself is sponsored.
        const nativeRaw = solanaSolRaw ?? BigInt(0);
        const wrappableSolRaw =
          nativeRaw > SOLANA_NATIVE_RESERVE_LAMPORTS
            ? nativeRaw - SOLANA_NATIVE_RESERVE_LAMPORTS
            : BigInt(0);
        const available = (solanaWsolRaw ?? BigInt(0)) + wrappableSolRaw;
        if (available >= collateral) {
          return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
        }
        // Can't bridge SOL/wSOL via CCTP — user must deposit
        return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - available };
      }

      // Base calls: existing WETH/cbBTC logic — handled by AcceptModal on-chain check
      return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
    },
    [],
  );

  const executeBridgeAndTrade = useCallback(
    async (params: {
      quote: PriceQuote;
      amount: number;
      isBuy: boolean;
      assetSlug: string;
      sourceChain: ChainId;
      deficit: bigint;
    }): Promise<BridgeAndTradeResult> => {
      const { quote, amount, isBuy, assetSlug, sourceChain, deficit } =
        params;
      const destChain: ChainId =
        sourceChain === "base" ? "solana" : "base";

      if (!address) throw new Error("Smart wallet not connected");
      if (!solanaAddress) throw new Error("Solana wallet not ready");
      if (!user?.id) throw new Error("Privy user not authenticated");

      // maxFee = 0: our backend relayer handles attestation + receiveMessage
      // directly (standard CCTP flow), so no fast-relayer fee is needed.
      const maxFee = BigInt(0);

      if (sourceChain === "base") {
        return executeBaseToSolana(
          quote, amount, isBuy, assetSlug, deficit, maxFee,
          address, solanaAddress, user.id,
        );
      }
      return executeSolanaToBase(
        quote, amount, isBuy, assetSlug, deficit, maxFee,
        address, solanaAddress, user.id,
      );
    },
    [address, solanaAddress, user, sendBatchTx, signSolanaTransaction],
  );

  // -----------------------------------------------------------------------
  // Base → Solana: backend submits pre-signed Solana trade tx
  // -----------------------------------------------------------------------
  async function executeBaseToSolana(
    quote: PriceQuote,
    amount: number,
    isBuy: boolean,
    assetSlug: string,
    deficit: bigint,
    maxFee: bigint,
    smartWalletAddr: string,
    solanaAddr: string,
    userId: string,
  ): Promise<BridgeAndTradeResult> {
    const solanaPk = toPublicKey(solanaAddr, "Solana wallet");
    const recipient = solanaToBytes32(solanaPk);

    // 2a. Burn USDC on Base via smart wallet
    const burnCalls = buildEvmBurnCalls(deficit, recipient, maxFee);
    const burnTxHash = (await sendBatchTx(burnCalls)) as string;

    // 2b. Sign Solana trade tx (no send)
    const tradeTx = await buildSolanaTradeTransaction(
      quote, amount, isBuy, assetSlug, solanaPk,
    );
    const serialized = tradeTx.serialize();
    const signed = await signSolanaTransaction(serialized);
    const signedTradeTx = Buffer.from(signed).toString("base64");

    // 3. POST to backend
    const { job_id: jobId } = await api.bridgeAndTrade({
      burnTxHash,
      signedTradeTx,
      quoteId: quote.quote_id!,
      sourceChain: "base",
      destChain: "solana",
      userId,
      mintRecipient: solanaAddr,
      burnAmount: deficit.toString(),
    });

    // 4. Poll until terminal
    const job = await pollBridgeStatus(jobId);
    return jobToResult(jobId, job);
  }

  // -----------------------------------------------------------------------
  // Solana → Base: frontend executes Base trade after backend mints
  // -----------------------------------------------------------------------
  async function executeSolanaToBase(
    quote: PriceQuote,
    amount: number,
    isBuy: boolean,
    assetSlug: string,
    deficit: bigint,
    maxFee: bigint,
    smartWalletAddr: string,
    solanaAddr: string,
    userId: string,
  ): Promise<BridgeAndTradeResult> {
    const solanaPk = toPublicKey(solanaAddr, "Solana wallet");
    const evmRecipient = evmToBytes32(
      smartWalletAddr as `0x${string}`,
    );

    // 2. Burn USDC on Solana
    const burnTx = await buildSolanaBurnTransaction(
      solanaPk, deficit, evmRecipient, maxFee,
    );
    const serialized = burnTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    await signSolanaTransaction(serialized);
    const burnTxHash = burnTx.signature
      ? Buffer.from(burnTx.signature).toString("hex")
      : "";

    if (!burnTxHash) {
      throw new Error("Solana burn transaction did not return a hash");
    }

    // 3. POST to backend (signedTradeTx: null — frontend executes)
    const { job_id: jobId } = await api.bridgeAndTrade({
      burnTxHash,
      signedTradeTx: null,
      quoteId: quote.quote_id!,
      sourceChain: "solana",
      destChain: "base",
      userId,
      mintRecipient: smartWalletAddr,
      burnAmount: deficit.toString(),
    });

    // 4. Poll until mint_completed (USDC on Base)
    const job = await pollBridgeStatus(jobId);

    if (job.status === "failed") {
      return jobToResult(jobId, job);
    }

    if (
      job.status === "mint_completed" ||
      job.status === "mint_completed_trade_failed"
    ) {
      // 5. USDC arrived on Base — execute trade via smart wallet
      const tradeCalls = buildEvmTradeCalls(
        quote, amount, isBuy, assetSlug,
      );
      const tradeTxHash = (await sendBatchTx(tradeCalls)) as string;

      return {
        success: true,
        jobId,
        chainExecuted: "base",
        txHash: tradeTxHash,
      };
    }

    // completed (shouldn't happen without signedTradeTx, but handle)
    return jobToResult(jobId, job);
  }

  return { checkDeficit, executeBridgeAndTrade };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jobToResult(
  jobId: string,
  job: BridgeJob,
): BridgeAndTradeResult {
  return {
    success: job.status === "completed",
    jobId,
    chainExecuted: job.dest_chain,
    txHash: job.trade_tx_hash ?? job.mint_tx_hash ?? undefined,
    error: job.error_message ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Status polling (2s interval per backend recommendation)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 180; // 6 minutes max

async function pollBridgeStatus(jobId: string): Promise<BridgeJob> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const job = await api.getBridgeStatus(jobId);

    if (TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return {
    id: jobId,
    status: "failed",
    source_chain: "base",
    dest_chain: "solana",
    burn_tx_hash: "",
    burn_amount: "",
    mint_recipient: "",
    quote_id: "",
    mint_tx_hash: null,
    trade_tx_hash: null,
    error_message:
      "Timed out waiting for bridge completion. " +
      "Your funds may still be in transit — check your balance before retrying.",
    created_at: "",
    updated_at: "",
  };
}
