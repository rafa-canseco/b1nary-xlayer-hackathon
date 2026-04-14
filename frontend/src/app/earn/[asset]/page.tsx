"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { PriceMenuV2 } from "@/components/v2/PriceMenuV2";
import { getAssetConfig, DEFAULT_ASSET } from "@/lib/assets";

export default function EarnAssetPage({
  params,
}: {
  params: Promise<{ asset: string }>;
}) {
  const { asset } = use(params);
  const config = getAssetConfig(asset);

  if (!config) {
    redirect(`/earn/${DEFAULT_ASSET}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="sr-only">Earn Premium on {config.symbol}</h1>
      <PriceMenuV2 asset={config} />
    </main>
  );
}
