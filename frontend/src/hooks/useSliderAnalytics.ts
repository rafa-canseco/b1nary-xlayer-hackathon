"use client";

import { useRef, useCallback } from "react";

const DEBOUNCE_MS = 500;

let fallbackSessionId: string | null = null;

function getSessionId(): string {
  try {
    const key = "b1nary_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    if (!fallbackSessionId) fallbackSessionId = crypto.randomUUID();
    return fallbackSessionId;
  }
}

export function useSliderAnalytics() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const track = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const event = {
        session_id: getSessionId(),
        event_type: eventType,
        data,
      };

      import("@/lib/api")
        .then(({ api }) => api.trackEvent(event))
        .catch(() => {
          // analytics is best-effort — never block UX
        });
    }, DEBOUNCE_MS);
  }, []);

  const trackSliderUse = useCallback(
    (selectedPrice: number, side: "buy" | "sell") => {
      track("slider_use", { selected_price: selectedPrice, side });
    },
    [track],
  );

  return { trackSliderUse };
}
