"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { DepositModal } from "@/components/DepositModal";
import { IS_XLAYER } from "@/lib/contracts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ConnectButton() {
  const { address, solanaAddress, isConnected, isReady, connectWallet } =
    useWallet();
  const { usd, okb, loading: balancesLoading } = useBalances(address);
  const { solanaUsdc, loading: solLoading } = useSolanaBalance(solanaAddress);
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />
    );
  }

  if (isConnected) {
    const total = IS_XLAYER ? usd : usd + solanaUsdc;
    const loading = IS_XLAYER ? balancesLoading : balancesLoading || solLoading;
    const hasBalance = total > 0;
    const balanceLabel = hasBalance
      ? `$${total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "Deposit";

    return (
      <>
        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors flex items-center gap-1.5">
              {loading ? "..." : balanceLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-3 border-[var(--border)] bg-[var(--bg)]"
            align="end"
          >
            <div className="space-y-2 text-sm">
              {IS_XLAYER ? (
                <>
                  <div className="flex justify-between text-[var(--text)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-[7px] font-bold text-[var(--bg)]">X</span>
                      USDC
                    </span>
                    <span className="font-mono">
                      ${usd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text)]">
                    <span className="flex items-center gap-1.5">
                      <img src="/okb.svg" alt="OKB" className="w-3.5 h-3.5 rounded-full" />
                      OKB
                    </span>
                    <span className="font-mono">
                      {okb.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-[var(--text)]">
                    <span className="flex items-center gap-1.5">
                      <img src="/base.svg" alt="Base" className="w-3.5 h-3.5" />
                      Base
                    </span>
                    <span className="font-mono">
                      ${usd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text)]">
                    <span className="flex items-center gap-1.5">
                      <img
                        src="/sol.png"
                        alt="Solana"
                        className="w-3.5 h-3.5 rounded-full"
                      />
                      Solana
                    </span>
                    <span className="font-mono">
                      ${solanaUsdc.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </>
              )}
              <div className="h-px bg-[var(--border)]" />
              <button
                onClick={() => setShowDeposit(true)}
                className="w-full text-center text-xs text-[var(--accent)] hover:underline"
              >
                Deposit
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {showDeposit && (
          <DepositModal onClose={() => setShowDeposit(false)} />
        )}
      </>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
