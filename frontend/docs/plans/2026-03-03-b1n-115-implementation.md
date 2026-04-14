# B1N-115: Deduplicate Duration Selector by expiry_date — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the duration selector so it shows exactly 3 options (one per Friday expiry) by
deduplicating on the stable `expiry_date` field instead of the drifting `expiry_days` integer.

**Architecture:** The backend (B1N-114, done) now returns `expiry_date: "2026-03-07"` alongside
`expiry_days`. The frontend changes are confined to the `PriceQuote` type and `PriceMenuV2`.
Dead code (`PriceMenu.tsx` v1) is deleted. No new abstractions needed.

**Tech Stack:** Next.js 14, React, TypeScript. Package manager: `bun`. Type check: `tsc --noEmit`.
No unit test framework — verification is type check + visual browser inspection.

---

### Task 1: Add `expiry_date` to `PriceQuote`

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add the field to the interface**

In `src/lib/api.ts`, add `expiry_date` after `expiry_days`:

```typescript
export interface PriceQuote {
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  expiry_date: string;   // ← add this line (ISO date, e.g. "2026-03-07", stable for the week)
  premium: number;
  // ... rest unchanged
}
```

**Step 2: Run type check to confirm no breakage**

```bash
bun run tsc --noEmit
```

Expected: 0 errors (the field is additive; nothing reads it yet).

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add expiry_date field to PriceQuote type (B1N-115)"
```

---

### Task 2: Update `PriceMenuV2` to deduplicate and filter by `expiry_date`

**Files:**
- Modify: `src/components/v2/PriceMenuV2.tsx`

This is the core change. Three things need updating: the `expiries` memo, the
`selectedExpiry` state type, and the `filteredPrices` filter. Also replace the
`untilDate` helper so the display label and the "(Xd)" countdown are both derived from
the stable `expiry_date` string.

**Step 1: Replace `untilDate` with `expiry_date`-aware helpers**

Remove the existing `untilDate(expiryDays: number)` function (lines 20-24) and replace
it with these two helpers:

```typescript
function expiryLabel(expiryDate: string): string {
  const d = new Date(expiryDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

**Step 2: Change `expiries` memo to deduplicate by `expiry_date`**

Replace the current `expiries` memo (lines 104-107):

```typescript
// BEFORE
const expiries = useMemo(() => {
  const unique = [...new Set(prices.map((p) => p.expiry_days))].sort((a, b) => a - b);
  return unique;
}, [prices]);

// AFTER
const expiries = useMemo(() => {
  const seen = new Set<string>();
  for (const p of prices) {
    seen.add(p.expiry_date);
  }
  return [...seen].sort();   // ISO strings sort correctly lexicographically
}, [prices]);
```

**Step 3: Change `selectedExpiry` state type from `number` to `string`**

```typescript
// BEFORE
const [selectedExpiry, setSelectedExpiry] = useState<number | null>(null);
const activeExpiry = selectedExpiry ?? expiries[0] ?? null;

// AFTER
const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
const activeExpiry = selectedExpiry ?? expiries[0] ?? null;
```

**Step 4: Change `filteredPrices` to filter by `expiry_date`**

```typescript
// BEFORE
.filter(
  (p) =>
    p.option_type === (side === "buy" ? "put" : "call") &&
    p.expiry_days === activeExpiry &&
    ...
)

// AFTER
.filter(
  (p) =>
    p.option_type === (side === "buy" ? "put" : "call") &&
    p.expiry_date === activeExpiry &&
    ...
)
```

**Step 5: Update the duration button to use new helpers**

The button inside the duration `expiries.map(...)` (around line 263):

```typescript
// BEFORE
{expiries.map((days) => (
  <button
    key={days}
    onClick={() => { setSelectedExpiry(days); }}
    ...
  >
    {untilDate(days)} ({days}d)
  </button>
))}

// AFTER
{expiries.map((d) => (
  <button
    key={d}
    onClick={() => { setSelectedExpiry(d); }}
    ...
  >
    {expiryLabel(d)} ({daysUntil(d)}d)
  </button>
))}
```

**Step 6: Fix the `useEffect` quote-persistence comparison**

Line 132 compares `match.expiry_days !== prev.expiry_days`. This is fine to leave as-is
(still correct for detecting quote refreshes), but update the active-expiry comparison
on line 120 if `expiry_days` was used there — that line is already handled by Step 4.

Also check the live preview display line (~line 393):

```typescript
// BEFORE
{Math.round(selectedApr)}% APR · {activeExpiry}d

// AFTER — activeExpiry is now a date string, so compute days for display
{Math.round(selectedApr)}% APR · {activeExpiry ? daysUntil(activeExpiry) : 0}d
```

**Step 7: Run type check**

```bash
bun run tsc --noEmit
```

Expected: 0 errors.

**Step 8: Commit**

```bash
git add src/components/v2/PriceMenuV2.tsx
git commit -m "feat: deduplicate duration selector by expiry_date (B1N-115)"
```

---

### Task 3: Delete dead code `PriceMenu.tsx` (v1)

**Files:**
- Delete: `src/components/PriceMenu.tsx`

Verify it is not imported anywhere before deleting:

```bash
grep -r "from.*PriceMenu[^V]" src/
```

Expected: no output.

Then delete:

```bash
trash src/components/PriceMenu.tsx
```

Run type check again to confirm nothing broke:

```bash
bun run tsc --noEmit
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete unused PriceMenu v1 component (B1N-115)"
```

---

### Task 4: Push branch and create PR

**Step 1: Push**

```bash
git push -u origin feat/b1n-115-deduplicate-duration-selector-by-expiry-date
```

**Step 2: Create PR targeting `dev`**

```bash
gh pr create \
  --title "B1N-115: Deduplicate duration selector by expiry_date instead of expiry_days" \
  --base dev \
  --body "$(cat <<'EOF'
## What

Uses the stable `expiry_date` field (added in B1N-114) to deduplicate and filter the
duration selector instead of the drifting `expiry_days` integer.

## Why

`expiry_days` is an integer that decrements each day. For the same Friday-expiry oToken,
Monday shows "10d" and Tuesday shows "9d" — both land in the `Set`, causing duplicate
slots in the UI. `expiry_date` is a stable ISO string ("2026-03-07") that doesn't change.

## Changes

- `src/lib/api.ts`: add `expiry_date: string` to `PriceQuote`
- `src/components/v2/PriceMenuV2.tsx`: deduplicate + filter by `expiry_date`; countdown
  computed from date arithmetic, not the raw `expiry_days` value
- `src/components/PriceMenu.tsx`: deleted (unused v1 component)

## Acceptance criteria

- [ ] Duration selector shows exactly 3 options (one per Friday expiry)
- [ ] No duplicate or consecutive-day clusters
- [ ] The "(Xd)" label counts down correctly as the week progresses
- [ ] Selecting a duration correctly filters the strike price list

Closes B1N-115
EOF
)"
```

**Step 3: Post completion summary on Linear issue and move to Review**

Update Linear issue B1N-115:
- Post comment with PR link and what was delivered
- Move state to "In Progress" → "Review"
