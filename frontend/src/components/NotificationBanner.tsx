"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { api } from "@/lib/api";
import type { NotificationStatus } from "@/hooks/useNotificationStatus";

type BannerState = "idle" | "email-form" | "code-verify" | "verified" | "manage-open";

interface Props {
  walletAddress: string;
  status: NotificationStatus;
}

export function NotificationBanner({ walletAddress, status }: Props) {
  const { user } = usePrivy();
  const privyEmail =
    (user?.linkedAccounts as Array<{ type: string; address?: string }> | undefined)
      ?.find((a) => a.type === "email")?.address ?? "";

  const [state, setState] = useState<BannerState>("idle");
  const [initialized, setInitialized] = useState(false);
  const [email, setEmail] = useState(privyEmail);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized && !status.loading && !status.error) {
      setState(status.verified && !status.unsubscribed ? "verified" : "idle");
      setInitialized(true);
    }
  }, [initialized, status.loading, status.error, status.verified, status.unsubscribed]);

  if (!initialized || status.error) return null;

  // Cancel target: go back to verified if they already have a verified email
  const cancelTarget: BannerState =
    status.verified && !status.unsubscribed ? "verified" : "idle";

  async function handleSendCode() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.submitEmail(walletAddress, email);
      setCode("");
      setState("code-verify");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to send code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.verifyCode(walletAddress, code);
      setState("verified");
      status.refetch();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Invalid or expired code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setErrorMsg(null);
    setCode("");
    try {
      await api.submitEmail(walletAddress, email);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to resend code.");
    }
  }

  async function handleUnsubscribe() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.unsubscribe(walletAddress);
      setState("idle");
      status.refetch();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to turn off. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-base" aria-hidden>🔔</span>
          <div>
            <p className="text-sm font-semibold text-[var(--bone)]">Get expiry reminders</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Get notified when each position settles
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEmail(privyEmail);
            setErrorMsg(null);
            setState("email-form");
          }}
        >
          Set up
        </Button>
      </div>
    );
  }

  // ── Email form ────────────────────────────────────────────────────────────
  if (state === "email-form") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base" aria-hidden>🔔</span>
            <div>
              <p className="text-sm font-semibold text-[var(--bone)]">Enter your email</p>
              <p className="text-xs text-[var(--text-secondary)]">
                We&apos;ll send a 6-digit code to confirm
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setState(cancelTarget)}>
            Cancel
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && !submitting && email && handleSendCode()}
          />
          <Button size="sm" onClick={handleSendCode} disabled={submitting || !email}>
            {submitting ? "Sending\u2026" : "Send code"}
          </Button>
        </div>
        {errorMsg && <p className="text-xs text-[var(--danger)]">{errorMsg}</p>}
      </div>
    );
  }

  // ── Code verification ─────────────────────────────────────────────────────
  if (state === "code-verify") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base" aria-hidden>✉️</span>
            <p className="text-sm font-semibold text-[var(--bone)]">Check your email</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setState("email-form")}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Code sent to <span className="text-[var(--bone)]">{email}</span> · expires in 10 min
        </p>
        <div className="space-y-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={submitting || code.length < 6}
            >
              {submitting ? "Verifying\u2026" : "Verify"}
            </Button>
            <button
              onClick={handleResend}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline-offset-2 hover:underline"
            >
              Resend code
            </button>
          </div>
        </div>
        {errorMsg && <p className="text-xs text-[var(--danger)]">{errorMsg}</p>}
      </div>
    );
  }

  // ── Verified (+ manage-open via Collapsible) ──────────────────────────────
  return (
    <Collapsible
      open={state === "manage-open"}
      onOpenChange={(open) => setState(open ? "manage-open" : "verified")}
    >
      <div className="rounded-xl bg-[var(--accent)]/7 border border-[var(--accent)]/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--accent)]">
                Notifications on
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {email || "Reminders are active"}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--accent)]/15">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setCode("");
                setErrorMsg(null);
                setState("email-form");
              }}
            >
              Change email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)]/10"
              onClick={handleUnsubscribe}
              disabled={submitting}
            >
              {submitting ? "Turning off\u2026" : "Turn off"}
            </Button>
          </div>
          {errorMsg && (
            <p className="text-xs text-[var(--danger)] mt-2">{errorMsg}</p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
