# B1N-20: Production Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all hardcoded Base Sepolia references with env-var-driven values so one codebase can deploy to both testnet and mainnet via different Vercel environments.

**Architecture:** Chain selection is centralized in `contracts.ts` — all other files import `CHAIN` from there instead of importing from `viem/chains` directly. Contract addresses move from hardcoded literals to `NEXT_PUBLIC_*` env vars. The faucet button is extracted into its own component so it can be conditionally rendered (and its hook never called) in production.

**Tech Stack:** Next.js 14, React, TypeScript, viem, Privy

---

## Pre-flight

```bash
cd frontend
tsc --noEmit   # baseline — must pass before you touch anything
```

---

### Task 1: Externalize chain selection in `contracts.ts`

**Files:**
- Modify: `src/lib/contracts.ts`

**Step 1: Replace hardcoded chain import and export**

In `src/lib/contracts.ts`, replace the top section (lines 1–4 and 23–26) with:

```ts
import { type Address, createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
export const CHAIN = chainId === 8453 ? base : baseSepolia;
```

Also update `publicClient` to use `CHAIN`:

```ts
export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(rpcUrl),
});
```

**Step 2: Type-check**

```bash
tsc --noEmit
```

Expected: 0 errors (contracts.ts no longer imports baseSepolia directly)

**Step 3: Commit**

```bash
git add src/lib/contracts.ts
git commit -m "feat(b1n-20): drive chain selection from NEXT_PUBLIC_CHAIN_ID"
```

---

### Task 2: Externalize contract addresses in `contracts.ts`

**Files:**
- Modify: `src/lib/contracts.ts`

**Step 1: Replace the hardcoded ADDRESSES object**

Replace the current `ADDRESSES` const (lines 6–16) with env-var reads:

```ts
export const ADDRESSES = {
  addressBook:  (process.env.NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS   ?? "") as Address,
  controller:   (process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS     ?? "") as Address,
  marginPool:   (process.env.NEXT_PUBLIC_MARGIN_POOL_ADDRESS    ?? "") as Address,
  oTokenFactory:(process.env.NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS ?? "") as Address,
  oracle:       (process.env.NEXT_PUBLIC_ORACLE_ADDRESS         ?? "") as Address,
  whitelist:    (process.env.NEXT_PUBLIC_WHITELIST_ADDRESS      ?? "") as Address,
  batchSettler: (process.env.NEXT_PUBLIC_BATCH_SETTLER_ADDRESS  ?? "") as Address,
  usdc:         (process.env.NEXT_PUBLIC_USDC_ADDRESS           ?? "") as Address,
  weth:         (process.env.NEXT_PUBLIC_WETH_ADDRESS           ?? "") as Address,
} as const;
```

**Step 2: Type-check**

```bash
tsc --noEmit
```

Expected: 0 errors

**Step 3: Verify locally still works**

Add the old testnet addresses to `.env.local` under the new var names (values are already in git history / `.env.local`). Start the dev server and confirm the Earn page loads without console errors.

```bash
bun dev
```

**Step 4: Commit**

```bash
git add src/lib/contracts.ts
git commit -m "feat(b1n-20): read contract addresses from env vars"
```

---

### Task 3: Update `providers.tsx` to use env-driven chain

**Files:**
- Modify: `src/lib/providers.tsx`

**Step 1: Replace hardcoded baseSepolia with CHAIN**

`providers.tsx` currently imports `baseSepolia` directly. Replace the import and the two usages:

```ts
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { CHAIN } from "@/lib/contracts";

function getPrivyAppId(): string {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to your .env.local file.",
    );
  }
  return id;
}

const PRIVY_APP_ID = getPrivyAppId();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#22D3EE",
        },
        defaultChain: CHAIN,
        supportedChains: [CHAIN],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
```

**Step 2: Type-check**

```bash
tsc --noEmit
```

Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/providers.tsx
git commit -m "feat(b1n-20): drive Privy defaultChain from env var"
```

---

### Task 4: Update `useWallet.ts` to use `CHAIN`

**Files:**
- Modify: `src/hooks/useWallet.ts`

**Step 1: Replace the two baseSepolia references**

Currently line 6 imports `baseSepolia` from `viem/chains`. Replace that import with `CHAIN` from contracts, then update both usages:

```ts
import { CHAIN } from "@/lib/contracts";
```

Line 46 (switchChain):
```ts
primaryWallet.switchChain(CHAIN.id)
```

Line 66 (walletClient):
```ts
chain: CHAIN,
```

Also update the error message string on line 51 to be generic:
```ts
"Failed to switch to the required chain. Transactions will fail.",
```

**Step 2: Type-check**

```bash
tsc --noEmit
```

Expected: 0 errors

**Step 3: Commit**

```bash
git add src/hooks/useWallet.ts
git commit -m "feat(b1n-20): use env-driven CHAIN in useWallet"
```

---

### Task 5: Extract FaucetButton component, gate by env var

**Background:** React hooks cannot be called conditionally. Currently `NavBar` always calls `useFaucet`. For production (`NEXT_PUBLIC_SHOW_FAUCET=false`) we want the hook to never execute. The solution is a `FaucetButton` component that owns the `useFaucet` call — NavBar only mounts it when the env var is true.

**Files:**
- Create: `src/components/FaucetButton.tsx`
- Modify: `src/components/NavBar.tsx`

**Step 1: Create `FaucetButton.tsx`**

```tsx
"use client";

import { useFaucet } from "@/hooks/useFaucet";
import type { BatchCall } from "@/hooks/useWallet";
import type { Address } from "viem";

type Props = {
  address: Address;
  sendBatchTx: (calls: BatchCall[]) => Promise<unknown>;
  refetch: () => void;
};

export function FaucetButton({ address, sendBatchTx, refetch }: Props) {
  const { mint, minting, showNotification, error } = useFaucet(address, sendBatchTx, refetch);

  return (
    <>
      <button
        onClick={mint}
        disabled={minting}
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
      >
        {minting ? "Getting funds..." : "Get Test Money"}
      </button>

      {showNotification && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2.5 text-sm text-[var(--accent)] animate-fade-in-up">
          You received 100,000 USD and 50 ETH test tokens.
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
```

**Step 2: Update `NavBar.tsx`**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

const SHOW_FAUCET = process.env.NEXT_PUBLIC_SHOW_FAUCET === "true";

export function NavBar() {
  const pathname = usePathname();
  const { address, sendBatchTx, chainError, isConnected } = useWallet();
  const { usd, usdFormatted, ethFormatted, loading: balLoading, refetch } = useBalances(address);

  const isStaging = typeof window !== "undefined" && window.location.hostname.startsWith("staging");

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
          {isConnected && !balLoading && usd > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <span>{usdFormatted} USD</span>
              <span className="opacity-40">·</span>
              <span>{ethFormatted} ETH</span>
            </div>
          )}
          {SHOW_FAUCET && isConnected && !balLoading && address && (
            <FaucetButton address={address} sendBatchTx={sendBatchTx} refetch={refetch} />
          )}
          <ConnectButton />
        </div>
      </header>

      {chainError && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {chainError}
        </div>
      )}
    </>
  );
}
```

**Step 3: Type-check**

```bash
tsc --noEmit
```

Expected: 0 errors

**Step 4: Smoke test faucet flow**

Ensure `.env.local` has `NEXT_PUBLIC_SHOW_FAUCET=true`, start dev server, connect wallet — faucet button should appear. Set to `false`, reload — button should be gone.

**Step 5: Commit**

```bash
git add src/components/FaucetButton.tsx src/components/NavBar.tsx
git commit -m "feat(b1n-20): extract FaucetButton, gate visibility by NEXT_PUBLIC_SHOW_FAUCET"
```

---

### Task 6: Update `.env.example`

**Files:**
- Modify: `.env.example`

**Step 1: Replace file contents**

```env
# Chain (8453 = Base mainnet, 84532 = Base Sepolia testnet)
NEXT_PUBLIC_CHAIN_ID=84532

# RPC & API
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_API_URL=http://localhost:8000

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=

# ERC-8021 builder attribution
NEXT_PUBLIC_BUILDER_CODE=

# Contract addresses
NEXT_PUBLIC_CONTROLLER_ADDRESS=
NEXT_PUBLIC_BATCH_SETTLER_ADDRESS=
NEXT_PUBLIC_ORACLE_ADDRESS=
NEXT_PUBLIC_WHITELIST_ADDRESS=
NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS=
NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS=
NEXT_PUBLIC_MARGIN_POOL_ADDRESS=

# Token addresses
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_WETH_ADDRESS=

# UI flags
# Set to "true" to show the testnet faucet button in NavBar
NEXT_PUBLIC_SHOW_FAUCET=false
```

**Step 2: Verify no references to NEXT_PUBLIC_DEMO_API_KEY remain**

```bash
grep -r "NEXT_PUBLIC_DEMO_API_KEY" src/
```

Expected: no output

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(b1n-20): update .env.example with all production vars"
```

---

### Task 7: Push branch and open PR

**Step 1: Push**

```bash
git push -u origin HEAD
```

**Step 2: Open PR targeting `dev`**

Title: `B1N-20: Frontend Production Config`

Body should include:
- What changed (summary of 5 files touched)
- How to verify (set `NEXT_PUBLIC_CHAIN_ID=8453` → confirm Privy uses Base mainnet; set `NEXT_PUBLIC_SHOW_FAUCET=false` → faucet button gone)
- Note that testnet addresses for `.env.local` are in the existing local file (not committed)

**Step 3: Move Linear issue to Review**

Post a completion summary comment on B1N-20 and move to "In Review".

---

## Success Criteria Checklist

- [ ] `tsc --noEmit` passes throughout
- [ ] `NEXT_PUBLIC_CHAIN_ID=8453` → app connects to Base mainnet, Privy shows Base mainnet
- [ ] `NEXT_PUBLIC_CHAIN_ID=84532` → app connects to Base Sepolia (existing behavior)
- [ ] `NEXT_PUBLIC_SHOW_FAUCET=false` → faucet button absent, `useFaucet` never called
- [ ] `NEXT_PUBLIC_SHOW_FAUCET=true` → faucet button visible when connected
- [ ] `.env.example` has no `NEXT_PUBLIC_DEMO_API_KEY`
- [ ] No `baseSepolia` direct import remaining in `contracts.ts`, `providers.tsx`, or `useWallet.ts`
