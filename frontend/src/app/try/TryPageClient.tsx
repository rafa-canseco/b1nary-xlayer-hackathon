"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TickingPrice } from "@/components/landing/TickingPrice";
import { PriceSlider } from "@/components/landing/PriceSlider";
import { BackgroundEffects } from "@/components/landing/BackgroundEffects";

const SPOT_BASE = 2621;

export default function TryPageClient() {
  const [spot, setSpot] = useState(SPOT_BASE);
  const handleSpotChange = useCallback((p: number) => setSpot(p), []);

  return (
    <div className="bg-[var(--bg)] min-h-screen relative overflow-hidden">
      {/* Background — same as landing page */}
      <BackgroundEffects />

      {/* Header */}
      <header className="relative z-[3] px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight font-mono">
          <span className="text-[var(--bone)]">b</span>
          <span className="text-[var(--accent)]">1</span>
          <span className="text-[var(--bone)]">nary</span>
        </Link>
        <Link
          href="/earn"
          className="rounded-lg px-4 py-2 text-sm font-medium border text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]/60 transition-all"
        >
          Open app
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-[3] max-w-3xl mx-auto px-6 py-12 sm:py-20 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <h1 className="text-[clamp(1.8rem,5vw,3rem)] font-light text-[var(--bone)] tracking-tight">
            Pick a price. See what you&apos;d earn.
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            ETH is{" "}
            <TickingPrice
              base={SPOT_BASE}
              className="text-[var(--text)] font-bold font-mono"
              onPriceChange={handleSpotChange}
            />
            {" "}right now. What price would you buy it at?
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PriceSlider spot={spot} />
        </motion.div>
      </main>
    </div>
  );
}
