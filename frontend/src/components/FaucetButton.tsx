"use client";

import { useFaucet } from "@/hooks/useFaucet";
import { IS_XLAYER } from "@/lib/contracts";
import type { Address } from "viem";

type Props = {
  address: Address | undefined;
  solanaAddress: string | undefined;
  refetch: () => void;
};

export function FaucetButton({ address, solanaAddress, refetch }: Props) {
  const { mint, minting, notification, error } = useFaucet({
    address,
    solanaAddress,
    onComplete: refetch,
  });

  return (
    <>
      <button
        onClick={mint}
        disabled={minting}
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
      >
        {minting
          ? "Getting funds..."
          : IS_XLAYER
            ? "Get Test Tokens"
            : "Get Test Money"}
      </button>

      {notification && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2.5 text-sm text-[var(--accent)] animate-fade-in-up">
          {notification}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
    </>
  );
}
