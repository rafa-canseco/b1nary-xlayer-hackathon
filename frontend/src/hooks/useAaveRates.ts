"use client";

import { useState } from "react";

export type AaveRates = Record<string, number>;

const FALLBACK_RATES: AaveRates = {
  okb: 0,
};

export function useAaveRates() {
  const [rates] = useState<AaveRates>(FALLBACK_RATES);
  return { rates, loading: false };
}
