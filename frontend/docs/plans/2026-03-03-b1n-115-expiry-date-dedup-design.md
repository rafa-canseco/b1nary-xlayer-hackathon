# B1N-115: Deduplicate duration selector by expiry_date

## Problem

The duration selector shows clusters of consecutive dates (e.g. Mar 9/10/11) because
it deduplicates by `expiry_days` (integer), which drifts by 1 each day for the same
oToken. A Friday-expiry option that shows "10d" on Sunday shows "9d" on Monday,
creating two Set entries for the same expiry window.

## Solution

B1N-114 (backend, complete) added a stable `expiry_date` field (ISO date string like
`"2026-03-07"`) to `GET /prices`. The frontend needs to use this as the canonical key
for deduplication and filtering.

## Changes

### `src/lib/api.ts`
- Add `expiry_date: string` to `PriceQuote` interface.

### `src/components/v2/PriceMenuV2.tsx`
- `expiries` memo: deduplicate by `expiry_date` → `string[]` sorted chronologically.
- `selectedExpiry` state: `string | null` (was `number | null`).
- `filteredPrices`: filter by `p.expiry_date === activeExpiry`.
- Replace `untilDate(days)` helper with one that parses from `expiry_date`.
- Button label: `{labelFromDate(d)} ({daysUntil(d)}d)` — countdown computed from
  `expiry_date` minus today, stable across the week.

### `src/components/PriceMenu.tsx` (v1)
- Delete. It is dead code (not imported anywhere). Removing avoids future confusion.

## What does NOT change
- `computeAPR` continues using `expiry_days` (correct for option pricing math).
- `AcceptModal` "committed for X days" continues using `expiry_days` from the quote.
- All APR calculations.

## Acceptance criteria
- Duration selector shows exactly 3 options (one per Friday expiry).
- No duplicate or consecutive-day clusters.
- The "(Xd)" label counts down correctly as the week progresses.
- Selecting a duration correctly filters prices for that expiry.
