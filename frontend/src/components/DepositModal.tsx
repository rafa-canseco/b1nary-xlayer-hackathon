"use client";

import { useState, useCallback, useEffect } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address } from "viem";
import { useWallet, type ExternalWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { publicClient, ADDRESSES, CHAIN, ERC20_ABI } from "@/lib/contracts";

type Tab = "deposit" | "withdraw";
type Token = "usdc" | "eth" | "weth" | "okb";
type AccountBalanceToken = Token;

interface TokenConfig {
  label: string;
  icon: string;
  decimals: number;
}

const TOKEN_META: Record<AccountBalanceToken, TokenConfig> = {
  usdc: { label: "USDC", icon: "/usdc.svg", decimals: 6 },
  eth: { label: "ETH", icon: "/eth.png", decimals: 18 },
  weth: { label: "WETH", icon: "/weth.png", decimals: 18 },
  okb: { label: "OKB", icon: "/okb.svg", decimals: 18 },
};

const AVAILABLE_TOKENS: Token[] = ["usdc", "okb"];

interface Props {
  onClose: () => void;
  requiredToken?: Token;
  onComplete?: () => void;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function refetchBalancesSoon() {
  window.dispatchEvent(new Event("balance:refetch"));
}

function TokenIcon({
  token,
  className,
}: {
  token: AccountBalanceToken;
  className: string;
}) {
  const meta = TOKEN_META[token];
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <img
        src={meta.icon}
        alt={meta.label}
        className="h-full w-full rounded-full"
      />
    </span>
  );
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const {
    address,
    fundingAddress,
    externalWallets,
    sendBatchTx,
    sendFundingTx,
    connectWallet,
    disconnect,
  } = useWallet();
  const [tab, setTab] = useState<Tab>("deposit");
  const [selectedWallet, setSelectedWallet] =
    useState<ExternalWallet | null>(null);
  const [token, setToken] = useState<Token>(requiredToken ?? "usdc");

  const smartBalances = useBalances(address);
  const selectedAddress =
    selectedWallet
      ? (selectedWallet.address as Address)
      : undefined;
  const eoaBalances = useBalances(selectedAddress ?? fundingAddress);
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "done"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [baseBalanceMenuOpen, setBaseBalanceMenuOpen] = useState(false);
  const [baseBalanceSearch, setBaseBalanceSearch] = useState("");
  const [baseBalanceToken, setBaseBalanceToken] =
    useState<AccountBalanceToken>("usdc");

  useEffect(() => {
    if (!selectedWallet && externalWallets.length > 0) {
      setSelectedWallet(externalWallets[0]);
    }
  }, [selectedWallet, externalWallets]);

  const meta = TOKEN_META[token];
  const filteredAssetTokens = AVAILABLE_TOKENS.filter((asset) =>
    TOKEN_META[asset].label.toLowerCase().includes(assetSearch.trim().toLowerCase()),
  );
  const baseBalanceTokens: AccountBalanceToken[] = ["usdc", "okb"];
  const filteredBaseBalanceTokens = baseBalanceTokens.filter((asset) =>
    TOKEN_META[asset].label.toLowerCase().includes(baseBalanceSearch.trim().toLowerCase()),
  );

  const getRawBalance = useCallback((asset: Token): bigint => {
    const balSource = tab === "deposit" ? eoaBalances : smartBalances;
    if (asset === "usdc") return balSource.usdRaw;
    if (asset === "eth") return balSource.ethRaw;
    if (asset === "weth") return balSource.wethRaw;
    if (asset === "okb") return balSource.okbRaw;
    return BigInt(0);
  }, [eoaBalances, smartBalances, tab]);

  const getSpendableRaw = useCallback((asset: Token): bigint => {
    return getRawBalance(asset);
  }, [getRawBalance]);

  const maxSpendableRaw = getSpendableRaw(token);
  const maxSpendableBalance = Number(formatUnits(maxSpendableRaw, meta.decimals));
  const selectedWalletAddress = selectedWallet?.address;

  const formatTokenBalance = useCallback((asset: Token): string => {
    const tokenMeta = TOKEN_META[asset];
    const balance = Number(formatUnits(getSpendableRaw(asset), tokenMeta.decimals));
    if (asset === "usdc") {
      return `$${balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `${balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })} ${tokenMeta.label}`;
  }, [getSpendableRaw]);

  const handleConnectWallet = useCallback(() => {
    connectWallet({
      walletList: ["metamask", "coinbase_wallet", "rainbow"],
      walletChainType: "ethereum-only",
      description: "Choose the wallet you want to use for deposits and withdrawals.",
    });
  }, [connectWallet]);

  const handleMax = useCallback(() => {
    if (maxSpendableRaw > BigInt(0)) {
      setAmountStr(formatUnits(maxSpendableRaw, meta.decimals));
    }
  }, [maxSpendableRaw, meta.decimals]);

  const getTradingBalanceRaw = useCallback((
    asset: AccountBalanceToken,
  ): bigint => {
    if (asset === "usdc") return smartBalances.usdRaw;
    if (asset === "eth") return smartBalances.ethRaw;
    if (asset === "weth") return smartBalances.wethRaw;
    if (asset === "okb") return smartBalances.okbRaw;
    return BigInt(0);
  }, [smartBalances]);

  const formatTradingBalance = useCallback((
    asset: AccountBalanceToken,
  ): string => {
    const tokenMeta = TOKEN_META[asset];
    const balance = Number(formatUnits(
      getTradingBalanceRaw(asset),
      tokenMeta.decimals,
    ));
    if (asset === "usdc") {
      return `$${balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }, [getTradingBalanceRaw]);

  const parseAmount = useCallback((): bigint | null => {
    try {
      const amount = parseUnits(amountStr, meta.decimals);
      if (amount === BigInt(0)) {
        setError("Enter an amount.");
        return null;
      }
      if (amount > maxSpendableRaw) {
        setError("Amount exceeds available balance.");
        return null;
      }
      return amount;
    } catch (err) {
      console.error("[DepositModal] parseUnits failed:", err);
      setError("Invalid amount.");
      return null;
    }
  }, [amountStr, maxSpendableRaw, meta.decimals]);

  const handleDeposit = useCallback(async () => {
    if (!address || !fundingAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    try {
      let hash: `0x${string}`;
      if (token === "eth") {
        hash = await sendFundingTx({
          to: address,
          data: "0x",
          value: amount,
        });
      } else {
        const tokenAddress =
          token === "usdc"
            ? ADDRESSES.usdc
            : token === "okb"
              ? (ADDRESSES.mokb ?? ADDRESSES.weth)
              : token === "weth"
                ? ADDRESSES.weth
                : ADDRESSES.usdc;
        hash = await sendFundingTx({
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [address, amount],
          }),
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setStatus("done");
      refetchBalancesSoon();
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] deposit failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, fundingAddress, parseAmount,
    token, sendFundingTx, onComplete,
  ]);

  const handleWithdraw = useCallback(async () => {
    const withdrawAddress = selectedWallet
      ? (selectedWallet.address as Address)
      : fundingAddress;
    if (!address || !withdrawAddress) {
      setError("Wallet not ready. Please reconnect.");
      return;
    }
    const amount = parseAmount();
    if (amount == null) return;

    setError(null);
    setStatus("pending");
    setTxHash(null);
    try {
      const tokenAddress =
        token === "usdc"
          ? ADDRESSES.usdc
          : token === "eth"
            ? null
            : token === "okb"
              ? (ADDRESSES.mokb ?? ADDRESSES.weth)
              : token === "weth"
                ? ADDRESSES.weth
                : ADDRESSES.usdc;

      const result = await sendBatchTx([
        tokenAddress
          ? {
              to: tokenAddress,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [withdrawAddress, amount],
              }),
            }
          : {
              to: withdrawAddress,
              data: "0x",
              value: amount,
            },
      ]);
      if (typeof result !== "string" || !result.startsWith("0x")) {
        throw new Error("Unexpected response from wallet");
      }
      const hash = result as `0x${string}`;
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setStatus("done");
      refetchBalancesSoon();
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed.",
      );
      setStatus("idle");
    }
  }, [
    address, fundingAddress, selectedWallet, parseAmount,
    token, sendBatchTx,
  ]);

  const isPending = status === "pending";
  const isDone = status === "done";
  const needsWallet = !selectedWallet;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={isPending ? undefined : onClose}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Manage funds
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2">
          <div className="rounded-xl bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-bold text-[var(--bg)]">X</span>
                <span className="text-sm font-semibold text-[var(--text)]">
                  X Layer trading account
                </span>
              </div>
              {address && (
                <span className="text-xs font-semibold text-[var(--accent)]">
                  Connected
                </span>
              )}
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setBaseBalanceMenuOpen((open) => !open);
                  setBaseBalanceSearch("");
                }}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]"
              >
                <TokenIcon token={baseBalanceToken} className="h-5 w-5" />
                {TOKEN_META[baseBalanceToken].label}
                <span className="text-[var(--text-secondary)]">⌄</span>
              </button>
              <span className="font-mono text-sm font-semibold text-[var(--text)]">
                {formatTradingBalance(baseBalanceToken)}
                {baseBalanceToken !== "usdc" ? ` ${TOKEN_META[baseBalanceToken].label}` : ""}
              </span>
              {baseBalanceMenuOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="border-b border-[var(--border)] p-2">
                    <input
                      type="text"
                      value={baseBalanceSearch}
                      onChange={(e) => setBaseBalanceSearch(e.target.value)}
                      placeholder="Search asset"
                      autoFocus
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto overscroll-contain">
                    {filteredBaseBalanceTokens.map((asset) => (
                      <button
                        key={asset}
                        type="button"
                        onClick={() => {
                          setBaseBalanceToken(asset);
                          setBaseBalanceMenuOpen(false);
                          setBaseBalanceSearch("");
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${
                          baseBalanceToken === asset
                            ? "bg-[var(--accent)]/10"
                            : "hover:bg-[var(--surface)]"
                        }`}
                      >
                        <TokenIcon token={asset} className="h-5 w-5" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--text)]">
                            {TOKEN_META[asset].label}
                          </span>
                          <span className="block text-xs font-mono text-[var(--text-secondary)]">
                            {formatTradingBalance(asset)}
                            {asset !== "usdc" ? ` ${TOKEN_META[asset].label}` : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                    {filteredBaseBalanceTokens.length === 0 && (
                      <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                        No assets found.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {address && (
              <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1">
                {truncate(address)}
              </p>
            )}
          </div>
        </div>

        <div className="flex rounded-xl bg-[var(--surface)] p-1 gap-1">
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setAmountStr("");
                setError(null);
                setStatus("idle");
                setTxHash(null);
              }}
              disabled={isPending}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              } disabled:opacity-40`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">
            {tab === "deposit" ? "From wallet" : "Withdraw to"}
          </p>
          {externalWallets.length === 0 ? (
            <button
              onClick={handleConnectWallet}
              className="w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              + Connect another wallet
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {externalWallets.map((w) => (
                <button
                  key={`${w.chain}-${w.address}`}
                  onClick={() => {
                    setSelectedWallet(w);
                    setAmountStr("");
                    setError(null);
                    setStatus("idle");
                    setTxHash(null);
                  }}
                  disabled={isPending}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border transition-colors text-left ${
                    selectedWallet?.address === w.address
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--text-secondary)]"
                  } disabled:opacity-40`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[var(--text)]">
                      {w.name}
                    </span>
                    <span className="ml-2 text-[var(--text-secondary)] font-mono text-xs">
                      {truncate(w.address)}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] shrink-0">
                    X Layer
                  </span>
                </button>
              ))}
              <button
                onClick={handleConnectWallet}
                disabled={isPending}
                className="w-full rounded-xl border border-dashed border-[var(--border)] py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
              >
                + Connect another wallet
              </button>
            </div>
          )}
          {selectedWallet && (
            <p className="text-xs text-[var(--text-secondary)]">
              {tab === "deposit"
                ? `${selectedWallet.name} → X Layer trading account`
                : `X Layer trading account → ${selectedWallet.name}`}
            </p>
          )}
        </div>

        {needsWallet ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Connect the wallet you want to use for deposits and withdrawals.
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={amountStr}
                      disabled={isPending || isDone}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (
                          raw === "" ||
                          /^(0|[1-9]\d*)?\.?\d*$/.test(raw)
                        ) {
                          setAmountStr(raw);
                        }
                      }}
                      className="w-full bg-transparent text-[var(--text)] font-semibold text-3xl focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {tab === "deposit" ? "Deposit" : "Withdraw"} on X Layer
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAssetMenuOpen((open) => !open);
                        setAssetSearch("");
                      }}
                      disabled={isPending || isDone}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-40"
                    >
                      <TokenIcon token={token} className="h-5 w-5" />
                      <span>{meta.label}</span>
                      <span className="text-[var(--text-secondary)]">⌄</span>
                    </button>
                    {assetMenuOpen && (
                      <div
                        className="absolute right-0 top-full z-10 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <div className="border-b border-[var(--border)] p-2">
                          <input
                            type="text"
                            value={assetSearch}
                            onChange={(e) => setAssetSearch(e.target.value)}
                            placeholder="Search asset"
                            autoFocus
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto overscroll-contain">
                          {filteredAssetTokens.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setToken(t);
                                setAmountStr("");
                                setError(null);
                                setStatus("idle");
                                setTxHash(null);
                                setAssetMenuOpen(false);
                                setAssetSearch("");
                              }}
                              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                                token === t
                                  ? "bg-[var(--accent)]/10"
                                  : "hover:bg-[var(--surface)]"
                              }`}
                            >
                              <TokenIcon token={t} className="h-6 w-6" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[var(--text)]">
                                  {TOKEN_META[t].label}
                                </span>
                                <span className="block text-xs font-mono text-[var(--text-secondary)]">
                                  {formatTokenBalance(t)}
                                </span>
                              </span>
                            </button>
                          ))}
                          {filteredAssetTokens.length === 0 && (
                            <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                              No assets found.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Balance {formatTokenBalance(token)}
                  </p>
                  <button
                    onClick={handleMax}
                    disabled={
                      isPending || isDone || maxSpendableBalance <= 0
                    }
                    className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    Max
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                {tab === "deposit"
                  ? `From ${selectedWallet?.name ?? "wallet"}`
                  : `To ${selectedWallet?.name ?? "wallet"}`}
              </p>
            </div>

            {tab === "withdraw" && selectedWalletAddress && (
              <p className="text-xs text-[var(--text-secondary)]">
                Withdraw to {truncate(selectedWalletAddress)}.
              </p>
            )}

            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {isDone ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-[var(--accent)] font-semibold">
                  {tab === "deposit"
                    ? "Deposit confirmed."
                    : "Withdrawal confirmed."}
                </p>
                {txHash && (
                  <a
                    href={`${CHAIN.blockExplorers?.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-[var(--accent)] hover:underline"
                  >
                    View transaction ↗
                  </a>
                )}
                <p className="text-center text-xs text-[var(--text-secondary)]">
                  Balance can take a few seconds to refresh.
                </p>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)] transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <button
                onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                disabled={
                  isPending || !amountStr || !(Number(amountStr) > 0)
                }
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                {isPending
                  ? tab === "deposit"
                    ? "Depositing..."
                    : "Withdrawing..."
                  : tab === "deposit"
                    ? `Deposit ${meta.label}`
                    : `Withdraw ${meta.label}`}
              </button>
            )}
          </>
        )}

        <button
          onClick={async () => {
            try {
              await disconnect();
            } catch (err) {
              console.error("[DepositModal] disconnect failed:", err);
            }
            onClose();
          }}
          disabled={isPending}
          className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
        >
          Disconnect wallet
        </button>
      </div>
    </div>
  );
}
