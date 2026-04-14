"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface NotificationStatus {
  hasEmail: boolean;
  verified: boolean;
  unsubscribed: boolean;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useNotificationStatus(
  walletAddress: string | undefined,
): NotificationStatus {
  const [hasEmail, setHasEmail] = useState(false);
  const [verified, setVerified] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .getNotificationStatus(walletAddress)
      .then((data) => {
        if (cancelled) return;
        setHasEmail(data.has_email);
        setVerified(data.verified);
        setUnsubscribed(data.unsubscribed);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tick]);

  return { hasEmail, verified, unsubscribed, loading, error, refetch };
}
