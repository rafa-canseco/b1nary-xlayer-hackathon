"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";
import { DEFAULT_ASSET } from "@/lib/assets";
import { IS_XLAYER } from "@/lib/contracts";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const SHOW_FAUCET = process.env.NEXT_PUBLIC_SHOW_FAUCET === "true";

export function NavBar() {
  const pathname = usePathname();
  const { address, fundingAddress, solanaAddress, isConnected } = useWallet();

  const { usd, eth, weth, wbtc, okb, usdFormatted, loading: balLoading, refetch } = useBalances(address);

  const isStaging = typeof window !== "undefined" && window.location.hostname.startsWith("staging");

  // Extract current asset from /earn/[asset] path
  const earnMatch = pathname.match(/^\/earn\/(\w+)/);
  const currentAsset = earnMatch?.[1] ?? DEFAULT_ASSET;

  return (
    <>
      {isStaging && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-1">
          STAGING — staging.b1nary.app
        </div>
      )}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--bone)] font-mono">
            b<span className="text-[var(--accent)]">1</span>nary
          </Link>
          <nav className="flex gap-4 text-sm">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`transition-colors ${
                  pathname.startsWith(href)
                    ? "text-[var(--text)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && !balLoading && (usd > 0 || eth > 0 || weth > 0 || wbtc > 0 || okb > 0) && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <img src="/usdc.svg" alt="USDC" className="w-4 h-4 inline" />
              <span>${usdFormatted}</span>
              {currentAsset === "okb" && okb > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{okb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} OKB</span>
                </>
              )}
              {currentAsset === "eth" && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{eth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ETH</span>
                  {weth > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{weth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} WETH</span>
                    </>
                  )}
                </>
              )}
              {currentAsset === "btc" && wbtc > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{wbtc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} cbBTC</span>
                </>
              )}
            </div>
          )}
          {SHOW_FAUCET && isConnected && !balLoading && (fundingAddress || solanaAddress) && (
            <FaucetButton address={fundingAddress} solanaAddress={solanaAddress} refetch={refetch} />
          )}
          <ConnectButton />
        </div>
      </header>

    </>
  );
}
