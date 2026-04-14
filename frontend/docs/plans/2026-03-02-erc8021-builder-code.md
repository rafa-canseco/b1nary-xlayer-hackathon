# ERC-8021 Builder Code Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Attribute all b1nary transactions to the app in the Base ecosystem via ERC-8021 Builder Codes.

**Architecture:** Two independent changes: (1) add `base:app_id` meta tag to root layout for Base App discovery, (2) append ERC-8021 data suffix to every transaction in `useWallet.ts` using the `ox` library. The builder code is read from `NEXT_PUBLIC_BUILDER_CODE` env var; when absent, transactions send normally without attribution.

**Tech Stack:** `ox` (ERC-8021 suffix generation), Next.js metadata API, Privy smart wallets.

---

### Task 1: Add `base:app_id` meta tag

**Files:**
- Modify: `src/app/layout.tsx:8-35` (metadata export)

**Step 1: Add `other` field to metadata**

Add the `other` field with `base:app_id` to the existing `metadata` export in `layout.tsx`:

```ts
export const metadata: Metadata = {
  title: {
    default: "b1nary | Set your price. Get paid.",
    template: "%s | b1nary",
  },
  description:
    "Pick a price you'd buy or sell ETH at. Earn premium upfront, no matter what happens. Fully collateralized options on Base.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "base:app_id": "69a5b7c877bc7576330f4b09",
  },
  openGraph: {
    type: "website",
    siteName: "b1nary",
    title: "b1nary | Set your price. Get paid.",
    description:
      "Pick a price you'd buy or sell ETH at. Earn premium upfront, no matter what happens. Fully collateralized options on Base.",
  },
  twitter: {
    card: "summary",
    title: "b1nary | Set your price. Get paid.",
    description:
      "Pick a price you'd buy or sell ETH at. Earn premium upfront, no matter what happens.",
  },
};
```

**Step 2: Verify meta tag renders**

Run: `cd frontend && bun dev`

Open http://localhost:3000, view page source, and confirm `<meta name="base:app_id" content="69a5b7c877bc7576330f4b09">` is in the `<head>`.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add base:app_id meta tag for Base App discovery (B1N-110)"
```

---

### Task 2: Install `ox` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install `ox`**

Run: `cd frontend && bun add ox`

**Step 2: Verify install**

Run: `bun run build`
Expected: Build succeeds without errors.

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add ox for ERC-8021 attribution suffix (B1N-110)"
```

---

### Task 3: Append ERC-8021 suffix to transactions

**Files:**
- Modify: `src/hooks/useWallet.ts:1-77`

**Step 1: Add suffix generation at module level**

Add import and suffix computation at the top of `useWallet.ts`, after existing imports:

```ts
import { Attribution } from "ox/erc8021";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : null;
```

**Step 2: Create helper function**

Add a helper that appends the suffix to a call's data, with the guard for calls without `data` (required by orchestrator review):

```ts
function appendSuffix(call: BatchCall): BatchCall {
  if (!DATA_SUFFIX || !call.data) return call;
  return {
    ...call,
    data: `${call.data}${DATA_SUFFIX.slice(2)}` as `0x${string}`,
  };
}
```

**Step 3: Use helper in sendBatchTx**

In the `sendBatchTx` callback, modify the `calls` mapping inside `client.sendTransaction()`:

Change:
```ts
calls: calls.map((c) => ({
  to: c.to,
  data: c.data,
  value: c.value,
})),
```

To:
```ts
calls: calls.map(appendSuffix).map((c) => ({
  to: c.to,
  data: c.data,
  value: c.value,
})),
```

**Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds. No type errors.

**Step 5: Commit**

```bash
git add src/hooks/useWallet.ts
git commit -m "feat: append ERC-8021 builder code suffix to all transactions (B1N-110)"
```

---

### Task 4: Verify end-to-end

**Step 1: Run lint**

Run: `cd frontend && bun run lint`
Expected: No errors.

**Step 2: Run build**

Run: `cd frontend && bun run build`
Expected: Clean build.

**Step 3: Manual verification checklist**

- [ ] `bun dev` → view source → `<meta name="base:app_id" content="69a5b7c877bc7576330f4b09">` in head
- [ ] Without `NEXT_PUBLIC_BUILDER_CODE` set: transactions send normally (no suffix, no error)
- [ ] With `NEXT_PUBLIC_BUILDER_CODE=bc_test123` in `.env.local`: confirm log output shows calls with appended data

**Step 4: Final commit (if any fixups needed)**

```bash
git commit -m "fix: address lint/build issues (B1N-110)"
```
