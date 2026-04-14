"use client";

import { useState } from "react";
import {
  maxUint256,
  encodeFunctionData,
  type Address,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import {
  publicClient,
  ADDRESSES,
  CHAIN,
  ERC20_ABI,
  WETH_ABI,
} from "@/lib/contracts";
import type { BatchCall } from "@/hooks/useWallet";
import { api, type PriceQuote } from "@/lib/api";
import { saveOptimistic } from "@/lib/optimisticPositions";
import { fmtUsd } from "@/lib/utils";
import { formatApr } from "@/lib/yield";
import { useAaveRates } from "@/hooks/useAaveRates";
import { YieldExplainer } from "@/components/yield/YieldExplainer";
import {
  computeCollateral,
  encodeExecuteOrder,
  fireAndPoll,
  readTokenBalance,
  buildOptimisticPosition,
} from "@/lib/execution";
import { encodeSwapExactOutput } from "@/lib/swap";
import { getAssetConfig } from "@/lib/assets";
import { DepositModal } from "@/components/DepositModal";
import { solanaTxUrl } from "@/lib/solana";

const DEADLINE_BUFFER_S = 60;

interface Props {
  putQuote: PriceQuote;
  callQuote: PriceQuote;
  putAmountUsd: number;
  callAmountEth: number;
  totalPremium: number;
  spotPrice?: number;
  assetSymbol?: string;
  assetSlug?: string;
  onClose: () => void;
  onAccepted: (info: {
    putTxHash: string | null;
    callTxHash: string | null;
  }) => void;
}

type RangeStep =
  | "idle"
  | "swapping"
  | "executing-put"
  | "executing-call"
  | "confirmed"
  | "partial-put-only";

function quoteIsValid(q: PriceQuote): boolean {
  return !!(
    q.otoken_address &&
    q.signature &&
    q.bid_price_raw &&
    q.deadline &&
    q.quote_id &&
    q.max_amount_raw != null &&
    q.maker_nonce != null
  );
}

function deadlineOk(q: PriceQuote): boolean {
  return (q.deadline ?? 0) > Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_S;
}

export function RangeAcceptModal({
  putQuote,
  callQuote,
  putAmountUsd,
  callAmountEth,
  totalPremium,
  spotPrice,
  assetSymbol = "ETH",
  assetSlug = "eth",
  onClose,
  onAccepted,
}: Props) {
  const { address, sendBatchTx, isConnected } = useWallet();
  const { rates: aaveRates } = useAaveRates();
  const [step, setStep] = useState<RangeStep>("idle");
  const [putTxHash, setPutTxHash] = useState<string | null>(null);
  const [callTxHash, setCallTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [didSwap, setDidSwap] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<"usdc" | "eth" | "btc" | "sol">("usdc");

  const loading = step === "swapping" || step === "executing-put" || step === "executing-call";
  const done = step === "confirmed";
  const explorerUrl = CHAIN.blockExplorers?.default.url ?? null;
  const txUrl = (hash: string) =>
    assetSlug === "sol" ? solanaTxUrl(hash) : `${explorerUrl}/tx/${hash}`;

  const stepLabels: Record<RangeStep, string> = {
    "idle": "Accept range",
    "swapping": "Swapping USDC to ETH...",
    "executing-put": "Executing lower side...",
    "executing-call": "Executing upper side...",
    "confirmed": "Done",
    "partial-put-only": "Upper side failed",
  };

  async function handleAccept() {
    if (!isConnected) {
      setDepositToken("usdc");
      setShowDeposit(true);
      return;
    }
    if (!address) {
      setDepositToken("usdc");
      setShowDeposit(true);
      return;
    }

    // Validate both quotes
    if (!quoteIsValid(putQuote) || !quoteIsValid(callQuote)) {
      setError("One or both options are not available on-chain yet.");
      return;
    }

    // Check deadlines with 60s buffer
    if (!deadlineOk(putQuote) || !deadlineOk(callQuote)) {
      setError("Quotes are expiring — please refresh prices and try again.");
      return;
    }

    setError(null);
    let lastStep = "idle";
    const updateStep = (s: RangeStep) => { lastStep = s; setStep(s); };

    try {
      // Compute collateral for both legs
      const putCol = computeCollateral(true, putAmountUsd, putQuote.strike, assetSlug);
      const callCol = computeCollateral(false, callAmountEth, callQuote.strike, assetSlug);

      // Asset-aware call side: ETH uses WETH (18 dec) + native, BTC uses cbBTC (8 dec)
      const isBtc = assetSlug === "btc";
      const callToken = callCol.collateralAsset; // WETH or cbBTC
      const callDecimals = isBtc ? 8 : 18;

      // Check balances
      const usdcBal = await readTokenBalance(ADDRESSES.usdc, address);
      const callTokenBal = await readTokenBalance(callToken, address);
      // Only ETH has usable native balance for wrapping
      const nativeBal = isBtc ? BigInt(0) : await publicClient.getBalance({ address });
      const callAvailable = callTokenBal + nativeBal;
      const callNeeded = callCol.collateral;

      const needsSwap = callAvailable < callNeeded && ADDRESSES.swapRouter !== null;

      if (needsSwap) {
        const swapRouter = ADDRESSES.swapRouter!;
        const callShortfall = callNeeded - callAvailable;
        const priceForSwap = spotPrice ?? putQuote.strike;
        const shortfallUnits = Number(callShortfall) / (10 ** callDecimals);
        const swapAmountUsdc = BigInt(Math.ceil(shortfallUnits * priceForSwap * 1.02 * 1e6));

        if (usdcBal < putCol.collateral + swapAmountUsdc) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }

        const assetConfig = getAssetConfig(assetSlug);
        const feeTier = assetConfig?.swapFeeTier ?? 3000;

        updateStep("swapping");

        const swapRouterAllowance = await publicClient.readContract({
          address: ADDRESSES.usdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as Address, swapRouter],
        });

        const swapCalls: BatchCall[] = [];
        if (swapRouterAllowance < swapAmountUsdc) {
          swapCalls.push({
            to: ADDRESSES.usdc,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [swapRouter, maxUint256],
            }),
          });
        }

        swapCalls.push({
          to: swapRouter,
          data: encodeSwapExactOutput(
            ADDRESSES.usdc,
            callToken,
            feeTier,
            address as Address,
            callShortfall,
            swapAmountUsdc,
          ),
        });

        const swapHash = await sendBatchTx(swapCalls) as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash: swapHash });
        setDidSwap(true);
      } else if (callAvailable < callNeeded) {
        setDepositToken(isBtc ? "btc" : assetSlug === "sol" ? "sol" : "eth");
        setShowDeposit(true);
        return;
      } else {
        if (usdcBal < putCol.collateral) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }
      }

      // Wrap native ETH → WETH if needed (ETH only, not BTC)
      if (!isBtc) {
        const wethBalAfterSwap = await readTokenBalance(callToken, address);
        if (wethBalAfterSwap < callNeeded) {
          const wrapAmount = callNeeded - wethBalAfterSwap;
          const wrapHash = await sendBatchTx([{
            to: ADDRESSES.weth,
            data: encodeFunctionData({
              abi: WETH_ABI,
              functionName: "deposit",
              args: [],
            }),
            value: wrapAmount,
          }]) as `0x${string}`;
          await publicClient.waitForTransactionReceipt({ hash: wrapHash });
        }
      }

      // === Execute put leg ===
      updateStep("executing-put");

      const putExecuteData = encodeExecuteOrder(putQuote, putCol.oTokenAmount, putCol.collateral);
      const putAllowance = await publicClient.readContract({
        address: putCol.collateralAsset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ADDRESSES.marginPool],
      });

      const putBalBefore = await readTokenBalance(putCol.collateralAsset, address);
      const putCalls: BatchCall[] = [];
      if (putAllowance < putCol.collateral) {
        putCalls.push({
          to: putCol.collateralAsset,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, maxUint256],
          }),
        });
      }
      putCalls.push({ to: ADDRESSES.batchSettler, data: putExecuteData });

      const putHash = await fireAndPoll(
        () => sendBatchTx(putCalls),
        async () => {
          const bal = await readTokenBalance(putCol.collateralAsset, address);
          return bal < putBalBefore;
        },
        "range-put",
      );
      if (putHash) setPutTxHash(putHash);

      // Generate group_id for this range pair
      const groupId = crypto.randomUUID();

      // Save put optimistic position
      const putPos = buildOptimisticPosition(putQuote, putAmountUsd, true, address, assetSlug, groupId);
      try { saveOptimistic(putPos); } catch (err) {
        console.warn("[RangeAcceptModal] Could not save optimistic position (put):", err);
      }

      // === Check call quote deadline before proceeding ===
      if (!deadlineOk(callQuote)) {
        updateStep("partial-put-only");
        setError("Lower side completed but upper quote expired. You can retry the upper side from the Earn page.");
        return;
      }

      // === Execute call leg ===
      updateStep("executing-call");

      const callExecuteData = encodeExecuteOrder(callQuote, callCol.oTokenAmount, callCol.collateral);
      const callAllowance = await publicClient.readContract({
        address: callCol.collateralAsset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ADDRESSES.marginPool],
      });

      const callBalBefore = await readTokenBalance(callCol.collateralAsset, address);
      const callCalls: BatchCall[] = [];
      if (callAllowance < callCol.collateral) {
        callCalls.push({
          to: callCol.collateralAsset,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, maxUint256],
          }),
        });
      }
      callCalls.push({ to: ADDRESSES.batchSettler, data: callExecuteData });

      const callHash = await fireAndPoll(
        () => sendBatchTx(callCalls),
        async () => {
          const bal = await readTokenBalance(callCol.collateralAsset, address);
          return bal < callBalBefore;
        },
        "range-call",
      );
      if (callHash) setCallTxHash(callHash);

      // Save call optimistic position
      const callPos = buildOptimisticPosition(callQuote, callAmountEth, false, address, assetSlug, groupId);
      try { saveOptimistic(callPos); } catch (err) {
        console.warn("[RangeAcceptModal] Could not save optimistic position (call):", err);
      }

      // Tag both positions with group_id in the backend (fire-and-retry)
      const txHashes = [putHash, callHash].filter(Boolean) as string[];
      if (txHashes.length === 2) {
        const tagGroup = async (retries = 5) => {
          for (let i = 0; i < retries; i++) {
            try {
              await api.groupPositions(groupId, txHashes, address);
              console.log("[RangeAcceptModal] Positions grouped:", groupId);
              return;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "";
              if (msg.includes("409") && i < retries - 1) {
                await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
                continue;
              }
              console.warn("[RangeAcceptModal] Could not group positions:", err);
              return;
            }
          }
        };
        tagGroup();
      }

      // Done
      updateStep("confirmed");
      onAccepted({ putTxHash: putHash, callTxHash: callHash });
      window.dispatchEvent(new Event("balance:refetch"));

    } catch (err: unknown) {
      console.error("[RangeAcceptModal] Transaction failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.match(/reject|denied|cancel/i)) {
        setError("Transaction cancelled.");
        setStep("idle");
      } else if (msg.includes("Timed out") || msg.includes("Lost connection")) {
        setError(msg);
      } else if (lastStep === "swapping") {
        setError("Swap failed. No funds were moved. Please try again.");
        setStep("idle");
      } else if (lastStep === "executing-put" && didSwap) {
        setError("Lower side failed, but the swap already completed. Your ETH is in your wallet. Please try again.");
        setStep("idle");
      } else if (lastStep === "executing-put") {
        setError("Lower side failed. No funds were moved. Please try again.");
        setStep("idle");
      } else if (lastStep === "executing-call") {
        setStep("partial-put-only");
        setError("Lower side completed but upper side failed. You can retry the upper side from the Earn page.");
      } else {
        setError("Transaction failed. Please try again.");
        setStep("idle");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Back */}
        <button
          onClick={onClose}
          disabled={loading}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          &larr; Back
        </button>

        {/* Title */}
        <div>
          <p className="text-lg font-semibold text-[var(--bone)]">
            Range: ${putQuote.strike.toLocaleString()} – ${callQuote.strike.toLocaleString()}
          </p>
          <p className="text-2xl font-bold text-[var(--accent)] font-mono mt-1">
            ${fmtUsd(totalPremium)}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            earned from both sides
          </p>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Summary */}
        <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
          <p>
            <span className="text-[var(--text)]">Lower:</span>{" "}
            ${putAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC at ${putQuote.strike.toLocaleString()}/{assetSymbol}
          </p>
          <p>
            <span className="text-[var(--text)]">Upper:</span>{" "}
            {callAmountEth.toFixed(4)} {assetSymbol} at ${callQuote.strike.toLocaleString()}/{assetSymbol}
          </p>
        </div>

        <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
          Collateral earns {assetSlug === "sol" ? "Kamino" : "Aave"} yield: {formatApr(aaveRates.usdc ?? 0)} on USDC · {formatApr(aaveRates[assetSlug] ?? 0)} on {assetSymbol}
          <YieldExplainer />
        </p>

        {/* Progress stepper */}
        {step !== "idle" && (
          <div className="space-y-2">
            {/* Swap step — only shown when swapping or after swap completed */}
            {(step === "swapping" || didSwap) && (
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === "swapping" ? "bg-[var(--accent)] text-[var(--bg)] animate-pulse" : "bg-[var(--accent)] text-[var(--bg)]"
                }`}>↔</div>
                <span className={`text-sm ${step === "swapping" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                  {step === "swapping" ? `Swapping USDC → ${assetSymbol}...` : "Swap done"}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === "executing-put" ? "bg-[var(--accent)] text-[var(--bg)] animate-pulse"
                : step === "swapping" ? "bg-[var(--border)] text-[var(--text-secondary)]"
                : "bg-[var(--accent)] text-[var(--bg)]"
              }`}>1</div>
              <span className={`text-sm ${step === "executing-put" ? "text-[var(--accent)]" : step === "swapping" ? "text-[var(--text-secondary)] opacity-50" : "text-[var(--text-secondary)]"}`}>
                {step === "executing-put" ? "Executing lower side..." : step === "swapping" ? "Lower side" : "Lower side done"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === "executing-call" ? "bg-[var(--accent)] text-[var(--bg)] animate-pulse"
                : step === "confirmed" ? "bg-[var(--accent)] text-[var(--bg)]"
                : step === "partial-put-only" ? "bg-[var(--danger)] text-[var(--bg)]"
                : "bg-[var(--border)] text-[var(--text-secondary)]"
              }`}>2</div>
              <span className={`text-sm ${
                step === "executing-call" ? "text-[var(--accent)]"
                : step === "partial-put-only" ? "text-[var(--danger)]"
                : step === "confirmed" ? "text-[var(--text-secondary)]"
                : "text-[var(--text-secondary)] opacity-50"
              }`}>
                {step === "executing-call" ? "Executing upper side..."
                  : step === "confirmed" ? "Upper side done"
                  : step === "partial-put-only" ? "Upper side failed"
                  : "Upper side"}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {/* Tx links */}
        {(putTxHash || callTxHash) && (assetSlug === "sol" || explorerUrl) && (
          <div className="flex gap-3 text-xs">
            {putTxHash && (
              <a href={txUrl(putTxHash)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                Lower tx
              </a>
            )}
            {callTxHash && (
              <a href={txUrl(callTxHash)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                Upper tx
              </a>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleAccept}
          disabled={loading || done}
          className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          {stepLabels[step]}
        </button>

        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
      </div>
    </div>
  );
}
