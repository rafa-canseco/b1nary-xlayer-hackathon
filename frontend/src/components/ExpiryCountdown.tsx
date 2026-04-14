"use client";

import { useState, useEffect } from "react";

interface Props {
  createdAt?: string;
  expiryDays?: number;
  expiryTimestamp?: number;
}

export function ExpiryCountdown({ createdAt, expiryDays, expiryTimestamp }: Props) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const expiryMs = expiryTimestamp
      ? expiryTimestamp * 1000
      : createdAt && expiryDays
        ? new Date(createdAt).getTime() + expiryDays * 86_400_000
        : NaN;

    if (Number.isNaN(expiryMs)) {
      setLabel("—");
      return;
    }

    const tick = () => {
      const remaining = expiryMs - Date.now();
      if (remaining <= 0) {
        setLabel("Expired");
        return;
      }
      const days = Math.floor(remaining / 86_400_000);
      const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
      if (days > 0) {
        setLabel(`${days}d ${hours}h left`);
      } else {
        const mins = Math.floor((remaining % 3_600_000) / 60_000);
        setLabel(`${hours}h ${mins}m left`);
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [createdAt, expiryDays, expiryTimestamp]);

  return <>{label}</>;
}
