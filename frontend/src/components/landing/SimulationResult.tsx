"use client";

import { memo, useState, useCallback, useEffect, type FormEvent } from "react";
import Link from "next/link";

// Module-level promise so every mount reuses the same in-flight request
let _countPromise: Promise<number> | null = null;

function fetchWaitlistCount(): Promise<number> {
  if (!_countPromise) {
    _countPromise = import("@/lib/api")
      .then(({ api }) => api.getWaitlistCount())
      .then((res) => res.count)
      .catch((err) => {
        console.error("[SimulationResult] Failed to load waitlist count:", err);
        _countPromise = null;
        return 0;
      });
  }
  return _countPromise;
}

function EmailCapture({ onSignup }: { onSignup?: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!email || status === "submitting" || status === "done") return;

      setStatus("submitting");

      import("@/lib/api")
        .then(({ api }) => api.joinWaitlist(email))
        .then((res) => {
          setStatus("done");
          if (res.new) onSignup?.();
        })
        .catch((err) => {
          console.error("[EmailCapture] Waitlist signup failed:", err);
          setStatus("error");
        });
    },
    [email, status, onSignup],
  );

  if (status === "done") {
    return (
      <div className="rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-3 animate-fade-in">
        <p className="text-sm font-medium text-[var(--accent)]">
          You&apos;re in. We&apos;ll let you know.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="you@email.com"
          aria-label="Email address for waitlist"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === "submitting" ? "..." : "Count me in"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-xs text-[var(--danger)] animate-fade-in">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}

function computeAPR(premium: number, collateral: number, expiryDays: number): number {
  if (collateral <= 0 || expiryDays <= 0) return 0;
  return (premium / collateral) * (365 / expiryDays) * 100;
}

export const SimulationResult = memo(function SimulationResult({
  premium,
  strike,
  spot,
  side,
  loading,
}: {
  premium: number;
  strike: number;
  spot: number;
  side: "buy" | "sell";
  loading: boolean;
}) {
  const collateralValue = side === "buy" ? strike : spot;
  const apr = Math.round(computeAPR(premium, collateralValue, 7));
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWaitlistCount().then((count) => {
      if (!cancelled) setWaitlistCount(count);
    });
    return () => { cancelled = true; };
  }, []);

  const incrementCount = useCallback(() => {
    setWaitlistCount((prev) => (prev !== null ? prev + 1 : 1));
  }, []);

  const collateral = side === "buy"
    ? `$${strike.toLocaleString()}`
    : "1 ETH";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-6 sm:p-8 space-y-6">
      {/* Earnings card */}
      <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
        <div className="rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/5 p-5 space-y-3">
          <p className="text-[clamp(1.3rem,3.5vw,1.8rem)] font-semibold text-[var(--accent)]">
            You&apos;d earn ${premium.toLocaleString()} this week
          </p>
          <p className="text-[var(--text-secondary)]">
            On {collateral} committed
          </p>
          {apr > 0 && (
            <span className="inline-block text-sm font-mono font-semibold text-[var(--accent)] bg-[var(--accent)]/10 rounded-full px-3 py-1">
              {apr > 200 ? ">200" : apr}% APR
            </span>
          )}
        </div>
      </div>

      {/* Trust line */}
      <p className="text-sm text-[var(--accent)]">
        Real yield. Not tokens. Not points. Paid upfront, every week.
      </p>

      {/* Email capture */}
      <div className="rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] p-4 space-y-2">
        {waitlistCount !== null && waitlistCount > 0 && (
          <p className="text-sm text-[var(--text)]">
            {waitlistCount} {waitlistCount === 1 ? "person is" : "people are"} waiting to try this for real.
          </p>
        )}
        <EmailCapture onSignup={incrementCount} />
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Link
          href="/"
          className="inline-block rounded-xl px-8 py-3 text-sm font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Learn how it works
        </Link>
      </div>
    </div>
  );
});
