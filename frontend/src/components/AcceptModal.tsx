"use client";

import { useState } from "react";
import {
  maxUint256,
  encodeFunctionData,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI, WETH_ABI } from "@/lib/contracts";
import type { BatchCall } from "@/hooks/useWallet";
import type { PriceQuote } from "@/lib/api";
import { saveOptimistic } from "@/lib/optimisticPositions";
import { getAssetConfig } from "@/lib/assets";
import {
  computeAPR,
  computeROI,
  computeCollateral,
  encodeExecuteOrder,
  fireAndPoll,
  readTokenBalance,
  buildOptimisticPosition,
} from "@/lib/execution";
import { floorTo, fmtAsset } from "@/lib/utils";
import { formatApr } from "@/lib/yield";
import { useAaveRates } from "@/hooks/useAaveRates";
import type { YieldMetric } from "./YieldToggle";
import { YieldExplainer } from "./yield/YieldExplainer";
import { DepositModal } from "@/components/DepositModal";

interface Props {
  quote: PriceQuote;
  side: "buy" | "sell";
  onClose: () => void;
  onAccepted: (info: { amount: number; txHash: string | null }) => void;
  renderExtra?: React.ReactNode | ((amount: number) => React.ReactNode);
  initialAmount?: string;
  confirmOnly?: boolean;
  maxPositionEth?: number;
  assetSymbol?: string;
  assetSlug?: string;
  yieldMetric?: YieldMetric;
}

type TxStep = "idle" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;

export function AcceptModal({ quote, side, onClose, onAccepted, renderExtra, initialAmount, confirmOnly, maxPositionEth, assetSymbol = "OKB", assetSlug = "okb", yieldMetric = "apr" }: Props) {
  const { address, sendBatchTx, isConnected } = useWallet();
  const { usd, okb, loading: baseBalLoading } = useBalances(address);
  const { rates: aaveRates } = useAaveRates();
  const [step, setStep] = useState<TxStep>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<"usdc" | "okb">("usdc");

  const isBuy = side === "buy";
  const isOkb = true;
  const assetConfig = getAssetConfig(assetSlug);
  const walletBalance = isBuy ? usd : okb;

  const capEth = maxPositionEth ?? quote.available_amount;
  const maxAmount = isBuy
    ? Math.min(quote.available_amount, capEth) * quote.strike
    : Math.min(quote.available_amount, capEth);
  const maxByBalance = walletBalance;
  const maxInputAmount = Math.min(maxByBalance, maxAmount);

  const [amountStr, setAmountStr] = useState(initialAmount ?? "");
  const amount = Number(amountStr) || 0;


  function handlePercent(pct: number) {
    setActivePercent(pct);
    const raw = maxInputAmount * (pct / 100);
    if (isBuy) {
      setAmountStr(floorTo(raw, 2).toString());
    } else {
      const decimals = assetConfig?.displayDecimals ?? 4;
      setAmountStr(floorTo(raw, decimals).toString());
    }
  }

  const apr = computeAPR(quote.premium, quote.strike, quote.expiry_days);
  const roi = computeROI(quote.premium, quote.strike);
  const yieldLabel = yieldMetric === "apr"
    ? `${Math.round(apr)}% APR`
    : `${roi.toFixed(1)}% ROI`;

  const ethEquiv = isBuy ? fmtAsset(amount / quote.strike) : String(amount);

  const scaledPremium = isBuy
    ? (quote.premium * amount) / quote.strike
    : quote.premium * amount;

  const premiumDisplay = `$${scaledPremium.toFixed(2)}`;

  const commitDisplay = isBuy
    ? `$${amount.toLocaleString()}`
    : `${amount} ${assetSymbol}`;

  const loading = step !== "idle";
  const buttonLabel =
    step === "executing"
      ? "Executing order..."
      : step === "confirmed"
        ? "Done"
        : !isConnected
          ? "Connect wallet"
          : "Accept";

  const minAmount = isBuy
    ? (assetConfig?.minBuyAmountUsd ?? 10)
    : (assetConfig?.minSellAmount ?? 0.005);

  async function handleAccept() {
    if (!isConnected) {
      setDepositToken(isBuy ? "usdc" : "okb");
      setShowDeposit(true);
      return;
    }

    if (!quote.otoken_address || !quote.signature || !quote.bid_price_raw
        || !quote.deadline || !quote.quote_id || quote.max_amount_raw == null
        || quote.maker_nonce == null) {
      setError("This option is not available on-chain yet.");
      return;
    }

    if (amount < minAmount) {
      const label = isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`;
      setError(`Minimum amount is ${label}.`);
      return;
    }
    if (amount > maxAmount) {
      const label = isBuy
        ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `${fmtAsset(maxAmount)} ${assetSymbol}`;
      setError(`Exceeds max trade size. Enter ${label} or less.`);
      return;
    }

    setError(null);
    let currentStep: TxStep = "idle";
    const updateStep = (s: TxStep) => { currentStep = s; setStep(s); };

    try {
      if (!address) {
        setDepositToken(isBuy ? "usdc" : "okb");
        setShowDeposit(true);
        return;
      }

      const { oTokenAmount, collateral, collateralAsset } =
        computeCollateral(isBuy, amount, quote.strike, assetSlug);

      let wrapAmount = BigInt(0);
      const okbAddr = ADDRESSES.mokb ?? ADDRESSES.weth;
      const okbBal = await readTokenBalance(okbAddr, address);
      if (!isBuy && okbBal < collateral) {
        setDepositToken("okb");
        setShowDeposit(true);
        return;
      }

      const executeData = encodeExecuteOrder(quote, oTokenAmount, collateral);
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset, abi: ERC20_ABI,
        functionName: "allowance", args: [address, ADDRESSES.marginPool],
      });

      updateStep("executing");

      if (wrapAmount > BigInt(0)) {
        const wrapHash = await sendBatchTx([{
          to: ADDRESSES.weth,
          data: encodeFunctionData({ abi: WETH_ABI, functionName: "deposit", args: [] }),
          value: wrapAmount,
        }]) as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });
      }

      const balanceBefore = await readTokenBalance(collateralAsset, address);
      const balanceDecreased = async () => {
        const bal = await readTokenBalance(collateralAsset, address);
        return bal < balanceBefore;
      };

      const approveAndExecuteCalls: BatchCall[] = [];
      if (currentAllowance < collateral) {
        approveAndExecuteCalls.push({
          to: collateralAsset,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.marginPool, maxUint256],
          }),
        });
      }
      approveAndExecuteCalls.push({ to: ADDRESSES.batchSettler, data: executeData });

      const label = currentAllowance < collateral ? "batch-approve-execute" : "executeOrder";
      const resultHash = await fireAndPoll(
        () => sendBatchTx(approveAndExecuteCalls),
        balanceDecreased,
        label,
      );
      if (resultHash) setTxHash(resultHash);

      updateStep("confirmed");
      onAccepted({ amount, txHash: resultHash });
      window.dispatchEvent(new Event("balance:refetch"));

      const pos = buildOptimisticPosition(quote, amount, isBuy, address, assetSlug);
      try { saveOptimistic(pos); } catch (err) {
        console.warn("[AcceptModal] Could not save optimistic position:", err);
      }
    } catch (err: unknown) {
      console.error("[AcceptModal] Transaction failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Timed out") || msg.includes("Lost connection")) {
        setError(msg);
      } else if (msg.includes("collateral vault is not initialized")) {
        setError(msg);
      } else if (currentStep === "idle") {
        setError("Could not read on-chain data. Check your connection and try again.");
      } else {
        setError("Transaction failed. No funds were moved. Please try again.");
      }
      setStep("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={loading}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          &larr; Back
        </button>

        <div>
          <p className="text-lg font-semibold text-[var(--bone)]">
            {isBuy ? "Buy" : "Sell"} {assetSymbol} at ${quote.strike.toLocaleString()}/{assetSymbol}
          </p>
          {amount > 0 && (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-2xl font-bold text-[var(--accent)] font-mono">
                {premiumDisplay}
              </p>
              <p className="text-sm font-semibold text-[var(--accent)] font-mono">
                {yieldLabel}
              </p>
            </div>
          )}
        </div>

        {!confirmOnly && (
          <>
            <div>
              <div className="grid grid-cols-4 gap-2">
                {PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercent(pct)}
                    disabled={loading || walletBalance <= 0}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activePercent === pct
                        ? "bg-[var(--accent)] text-[var(--bg)]"
                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
                    } disabled:opacity-40`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <img
                    src={isBuy ? "/usdc.svg" : "/okb.svg"}
                    alt={isBuy ? "USDC" : assetSymbol}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="text-sm font-bold text-[var(--bone)]">
                    {isBuy ? "USDC" : assetSymbol}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  disabled={loading}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                      setAmountStr(raw);
                      setActivePercent(null);
                    }
                  }}
                  className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none text-right"
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                Balance {baseBalLoading
                  ? "..."
                  : isBuy
                    ? `$${floorTo(walletBalance, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `${floorTo(walletBalance, 4).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${assetSymbol}`}
              </p>
              {amount > 0 && amount < minAmount && (
                <p className="text-xs text-[var(--danger)] mt-1">
                  Minimum is {isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`}
                </p>
              )}
            </div>
          </>
        )}

        {amount > 0 && (
          <>
            <div className="h-px bg-[var(--border)]" />
            <p className="text-sm text-[var(--text)]">
              You commit {commitDisplay} for {quote.expiry_days} days
            </p>

            <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
              Your collateral earns {formatApr(aaveRates[isBuy ? "usdc" : assetSlug] ?? 0)} APR via Aave while open
              <YieldExplainer />
            </p>

            {renderExtra ? (
              typeof renderExtra === "function" ? renderExtra(amount) : renderExtra
            ) : (
              <div className="space-y-1.5 text-sm">
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If price hits ${quote.strike.toLocaleString()}:</span>{" "}
                  {isBuy
                    ? `You buy ${ethEquiv} ${assetSymbol} + keep ${premiumDisplay}`
                    : `You sell ${amount} ${assetSymbol} + keep ${premiumDisplay}`}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">If not:</span>{" "}
                  {isBuy
                    ? `${commitDisplay} back + keep ${premiumDisplay}`
                    : `${amount} ${assetSymbol} back + keep ${premiumDisplay}`}
                </p>
              </div>
            )}
          </>
        )}

        {amount > 0 && amount < minAmount && (
          <p className="text-sm text-[var(--danger)]">
            Minimum is {isBuy ? `$${minAmount}` : `${minAmount} ${assetSymbol}`}
          </p>
        )}

        {amount > maxAmount && (
          <p className="text-sm text-[var(--danger)]">
            Exceeds max trade size — enter {isBuy
              ? `$${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : `${fmtAsset(maxAmount)} ${assetSymbol}`} or less.
          </p>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <button
          onClick={handleAccept}
          disabled={loading || amount < minAmount || amount > maxAmount}
          className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          {buttonLabel}
        </button>

        {step === "confirmed" && (
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Executed on X Layer
          </p>
        )}

        {step === "confirmed" && txHash && (
          <a
            href={`${CHAIN.blockExplorers?.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-[var(--accent)] hover:underline"
          >
            View transaction ↗
          </a>
        )}
      </div>

        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
    </div>
  );
}
