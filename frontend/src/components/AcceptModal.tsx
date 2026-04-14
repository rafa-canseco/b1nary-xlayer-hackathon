"use client";

import { useState } from "react";
import {
  maxUint256,
  encodeFunctionData,
  type Address,
} from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useBridgeAndTrade } from "@/hooks/useBridgeAndTrade";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI, WETH_ABI, IS_XLAYER } from "@/lib/contracts";
import {
  SOLANA_NATIVE_RESERVE_LAMPORTS,
  solanaTxUrl,
  toPublicKey,
} from "@/lib/solana";
import {
  buildSolanaTradeSetupTransaction,
  buildSolanaTradeTransaction,
} from "@/lib/bridgeTx";
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
  /** Asset slug ("eth" | "btc") to pick the right collateral token for calls */
  assetSlug?: string;
  yieldMetric?: YieldMetric;
}

type TxStep = "idle" | "executing" | "confirmed";

const PERCENTAGES = [25, 50, 75, 100] as const;
const RAW_COLLATERAL_BUFFER = BigInt(1);
const SOLANA_PRIVY_SAFE_MAIN_TX_BASE64_BYTES = 1290;
const SOLANA_PRIVY_SPLIT_SETUP_BASE64_BYTES = 1260;

function getSerializedBase64Length(tx: { serialize: () => Uint8Array }): number {
  return 4 * Math.ceil(tx.serialize().length / 3);
}

function formatSolRawAmount(rawLamports: bigint, decimals = 8): string {
  const divisor = BigInt(10) ** BigInt(9 - decimals);
  const displayUnits = rawLamports / divisor;
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = displayUnits / scale;
  const fraction = (displayUnits % scale).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}


export function AcceptModal({ quote, side, onClose, onAccepted, renderExtra, initialAmount, confirmOnly, maxPositionEth, assetSymbol = "ETH", assetSlug = "eth", yieldMetric = "apr" }: Props) {
  const { address, solanaAddress, sendBatchTx, sendSolanaTransaction, isConnected } = useWallet();
  const { usd, eth, weth, wbtc, okb, usdRaw: baseUsdcRaw, loading: baseBalLoading } = useBalances(address);
  const { solanaUsdcRaw, solanaUsdc, solanaWsolRaw, solanaSolRaw, solanaWsol, solanaSol, loading: solBalLoading } = useSolanaBalance(solanaAddress);
  const balancesLoading = baseBalLoading || solBalLoading;
  const { checkDeficit, executeBridgeAndTrade } = useBridgeAndTrade();
  const { rates: aaveRates } = useAaveRates();
  const [step, setStep] = useState<TxStep>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [chainExecuted, setChainExecuted] = useState<"base" | "solana" | "xlayer" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePercent, setActivePercent] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<"usdc" | "eth" | "btc" | "sol" | "okb">("usdc");

  const isBuy = side === "buy";
  const isBtc = assetSlug === "btc";
  const isSol = assetSlug === "sol";
  const isOkb = assetSlug === "okb";
  const assetConfig = getAssetConfig(assetSlug);
  const wrappableSolRaw =
    solanaSolRaw > SOLANA_NATIVE_RESERVE_LAMPORTS
      ? solanaSolRaw - SOLANA_NATIVE_RESERVE_LAMPORTS
      : BigInt(0);
  const solCollateralBalance =
    (Number(solanaWsolRaw + wrappableSolRaw) / 1e9);
  // For covered calls: ETH uses native + WETH, BTC uses WBTC, SOL uses wSOL + native SOL, OKB uses MockOKB
  // For buys: show USDC (on XLayer just local, otherwise combined Base + Solana)
  const walletBalance = isBuy
    ? IS_XLAYER ? usd : usd + solanaUsdc
    : isOkb
      ? okb
      : isSol
        ? solCollateralBalance
        : isBtc ? wbtc : eth + weth;

  const capEth = maxPositionEth ?? quote.available_amount;
  const maxAmount = isBuy
    ? Math.min(quote.available_amount, capEth) * quote.strike
    : Math.min(quote.available_amount, capEth);
  const solMaxByBalanceRaw =
    solanaWsolRaw + wrappableSolRaw > RAW_COLLATERAL_BUFFER
      ? solanaWsolRaw + wrappableSolRaw - RAW_COLLATERAL_BUFFER
      : BigInt(0);
  const maxByBalance = isBuy
    ? walletBalance
    : isSol
      ? Number(solMaxByBalanceRaw) / 1e9
      : walletBalance;
  const maxInputAmount = Math.min(maxByBalance, maxAmount);

  const [amountStr, setAmountStr] = useState(initialAmount ?? "");
  const amount = Number(amountStr) || 0;


  function handlePercent(pct: number) {
    setActivePercent(pct);
    if (!isBuy && isSol) {
      const raw = (solMaxByBalanceRaw * BigInt(pct)) / BigInt(100);
      setAmountStr(formatSolRawAmount(raw));
      return;
    }

    const raw = maxInputAmount * (pct / 100);
    if (isBuy) {
      setAmountStr(floorTo(raw, 2).toString());
    } else {
      const decimals = isSol ? 8 : (assetConfig?.displayDecimals ?? 4);
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

  const premiumDisplay = scaledPremium < 1
    ? `$${scaledPremium.toFixed(2)}`
    : `$${scaledPremium.toFixed(2)}`;

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
      setDepositToken(isBuy ? "usdc" : isOkb ? "okb" : isSol ? "sol" : isBtc ? "btc" : "eth");
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
      // --- Cross-chain bridge detection for buys (USDC bridgeable via CCTP) ---
      if (isBuy && quote.chain) {
        const deficit = checkDeficit(
          quote, amount, isBuy, assetSlug, baseUsdcRaw, solanaUsdcRaw,
          solanaWsolRaw, solanaSolRaw,
        );

        // Insufficient balance across both chains — prompt deposit
        if (deficit.needsDeposit) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }

        if (deficit.needsBridge && deficit.sourceChain) {
          if (!address || !solanaAddress) {
            setDepositToken("usdc");
            setShowDeposit(true);
            return;
          }
          updateStep("executing");
          const result = await executeBridgeAndTrade({
            quote, amount, isBuy, assetSlug,
            sourceChain: deficit.sourceChain,
            deficit: deficit.deficit,
          });

          if (result.success) {
            setTxHash(result.txHash ?? null);
            setChainExecuted(result.chainExecuted ?? null);
            updateStep("confirmed");
            onAccepted({ amount, txHash: result.txHash ?? null });
            window.dispatchEvent(new Event("balance:refetch"));

            const pos = buildOptimisticPosition(
              quote, amount, isBuy, address!, assetSlug,
            );
            try { saveOptimistic(pos); } catch (err) {
              console.warn("[AcceptModal] Could not save optimistic position:", err);
            }
          } else {
            setError(
              result.error ??
                "Bridge-and-trade failed. Check your balance before retrying.",
            );
            setStep("idle");
          }
          return;
        }

        // Sufficient on target chain — fall through to direct execution
      }

      // --- Solana sells: SOL/wSOL collateral (not bridgeable) ---
      if (!isBuy && quote.chain === "solana") {
        const deficit = checkDeficit(
          quote, amount, isBuy, assetSlug, baseUsdcRaw, solanaUsdcRaw,
          solanaWsolRaw, solanaSolRaw,
        );

        if (deficit.needsDeposit) {
          setDepositToken("sol");
          setShowDeposit(true);
          return;
        }
      }

      // --- Direct Solana execution (buys with enough on Solana, or sells) ---
      if (quote.chain === "solana") {
        if (!solanaAddress) {
          setError("Solana wallet not ready. Please wait and try again.");
          return;
        }

        updateStep("executing");

        const solanaPk = toPublicKey(solanaAddress, "Solana wallet");
        const { collateral } = computeCollateral(
          isBuy,
          amount,
          quote.strike,
          assetSlug,
        );

        let wrapAmount = BigInt(0);
        if (!isBuy && assetSlug === "sol" && solanaWsolRaw < collateral) {
          wrapAmount = collateral - solanaWsolRaw;
          if (wrappableSolRaw < wrapAmount) {
            setDepositToken("sol");
            setShowDeposit(true);
            setStep("idle");
            return;
          }
        }

        let tradeTx = await buildSolanaTradeTransaction(
          quote, amount, isBuy, assetSlug, solanaPk,
          isBuy ? undefined : solanaWsolRaw,
          wrapAmount,
        );

        const tradeTxBase64Length = getSerializedBase64Length(tradeTx);
        if (
          tradeTxBase64Length > SOLANA_PRIVY_SPLIT_SETUP_BASE64_BYTES
        ) {
          const setupTx = await buildSolanaTradeSetupTransaction(
            quote,
            amount,
            isBuy,
            assetSlug,
            solanaPk,
            wrapAmount,
            true,
          );
          if (setupTx) {
            await sendSolanaTransaction(setupTx);
            window.dispatchEvent(new Event("balance:refetch"));
          }

          tradeTx = await buildSolanaTradeTransaction(
            quote, amount, isBuy, assetSlug, solanaPk,
            isBuy ? undefined : collateral,
            BigInt(0),
            false,
            false,
          );
        }

        const finalTradeTxBase64Length = getSerializedBase64Length(tradeTx);
        if (finalTradeTxBase64Length > SOLANA_PRIVY_SAFE_MAIN_TX_BASE64_BYTES) {
          throw new Error(
            `Solana transaction is too large for sponsored execution (${finalTradeTxBase64Length} bytes).`,
          );
        }

        const signature = await sendSolanaTransaction(tradeTx);
        setTxHash(signature);
        setChainExecuted("solana");
        updateStep("confirmed");
        onAccepted({ amount, txHash: signature });
        window.dispatchEvent(new Event("balance:refetch"));

        const pos = buildOptimisticPosition(
          quote, amount, isBuy,
          solanaAddress as unknown as Address, assetSlug,
        );
        try { saveOptimistic(pos); } catch (err) {
          console.warn("[AcceptModal] Could not save optimistic position:", err);
        }
        return;
      }

      // --- Direct Base execution ---
      if (!address) {
        setDepositToken(isBuy ? "usdc" : isOkb ? "okb" : isSol ? "sol" : isBtc ? "btc" : "eth");
        setShowDeposit(true);
        return;
      }

      const { oTokenAmount, collateral, collateralAsset } =
        computeCollateral(isBuy, amount, quote.strike, assetSlug);

      // On-chain balance check for sells — redirect to deposit if underfunded
      let wrapAmount = BigInt(0);
      if (isOkb) {
        // OKB calls: MockOKB is ERC20, no wrapping needed
        const okbAddr = ADDRESSES.mokb ?? ADDRESSES.weth;
        const okbBal = await readTokenBalance(okbAddr, address);
        if (okbBal < collateral) {
          setDepositToken("okb");
          setShowDeposit(true);
          return;
        }
      } else if (isBtc) {
        // BTC calls: cbBTC is already ERC20, no wrapping needed
        const wbtcBal = await readTokenBalance(ADDRESSES.wbtc, address);
        if (wbtcBal < collateral) {
          setDepositToken("btc");
          setShowDeposit(true);
          return;
        }
      } else {
        // ETH calls: accept native ETH + WETH combined, wrap if needed
        const [wethBal, nativeBal] = await Promise.all([
          readTokenBalance(ADDRESSES.weth, address),
          publicClient.getBalance({ address }),
        ]);
        if (wethBal + nativeBal < collateral) {
          setDepositToken("eth");
          setShowDeposit(true);
          return;
        }
        if (wethBal < collateral) {
          wrapAmount = collateral - wethBal;
        }
      }

      const executeData = encodeExecuteOrder(quote, oTokenAmount, collateral);
      const currentAllowance = await publicClient.readContract({
        address: collateralAsset, abi: ERC20_ABI,
        functionName: "allowance", args: [address, ADDRESSES.marginPool],
      });

      updateStep("executing");

      // If wrapping is needed: wrap ETH → WETH first, wait for receipt,
      // then send approve + execute. This ensures WETH is available before
      // the collateral transfer is attempted.
      if (wrapAmount > BigInt(0)) {
        const wrapHash = await sendBatchTx([{
          to: ADDRESSES.weth,
          data: encodeFunctionData({ abi: WETH_ABI, functionName: "deposit", args: [] }),
          value: wrapAmount,
        }]) as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });
        console.log("[AcceptModal] ETH wrapped to WETH confirmed");
      }

      // After wrapping (if needed), WETH balance is sufficient. Now approve + execute.
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

      setChainExecuted(IS_XLAYER ? "xlayer" : (quote.chain ?? "base"));
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
        {/* Back button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          ← Back
        </button>

        {/* Title + earnings hero */}
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

        {/* Amount controls — hidden in confirmOnly mode */}
        {!confirmOnly && (
          <>
            {/* Percentage buttons */}
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

            {/* Amount input */}
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <img
                    src={isBuy ? "/usdc.svg" : isOkb ? "/okb.svg" : isSol ? "/sol.png" : `/${assetSlug === "btc" ? "cbbtc.webp" : "eth.png"}`}
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
                Balance {balancesLoading
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

        {/* Commit + outcomes */}
        {amount > 0 && (
          <>
            <div className="h-px bg-[var(--border)]" />
            <p className="text-sm text-[var(--text)]">
              You commit {commitDisplay} for {quote.expiry_days} days
            </p>

            <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
              Your collateral earns {formatApr(aaveRates[isBuy ? "usdc" : assetSlug] ?? 0)} APR via {isSol ? "Kamino" : "Aave"} while open
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

        {step === "confirmed" && chainExecuted && (
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Executed on {chainExecuted === "solana" ? "Solana" : chainExecuted === "xlayer" ? "X Layer" : "Base"}
          </p>
        )}

        {step === "confirmed" && txHash && (
          <a
            href={
              chainExecuted === "solana"
                ? solanaTxUrl(txHash)
                : `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`
            }
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
