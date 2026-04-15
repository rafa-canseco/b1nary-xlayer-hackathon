"use client";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function YieldExplainer() {
  return (
    <InfoTooltip
      title="Aave Yield"
      text="While your position is open, your collateral is deposited on X Layer and earns yield automatically. Yield is distributed weekly every Monday via airdrop to your wallet."
    />
  );
}
