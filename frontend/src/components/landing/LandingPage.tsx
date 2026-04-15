"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { BackgroundEffects } from "./BackgroundEffects";
import { usePrices } from "@/hooks/usePrices";
import { useSpot } from "@/hooks/useSpot";

const WORDMARK_FONT = "'Fira Code', monospace";
const TARGET = "b1nary";
const BINARY_CHARS = "01";

const FALLBACK_SPOT = 85;

function deriveStrikes(spot: number) {
  const buy = Math.round(spot * 0.92);
  const sell = Math.round(spot * 1.08);
  return { buyStrike: buy, sellStrike: sell };
}

/* ── Binary scramble hook ── */
function useBinaryReveal(trigger: boolean, duration = 2000) {
  const [display, setDisplay] = useState("      ");
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const animate = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const result = TARGET.split("").map((char, i) => {
      const charProgress = (progress - i * 0.1) / 0.4;
      if (charProgress >= 1) return char;
      return BINARY_CHARS[Math.floor(Math.random() * 2)];
    });
    setDisplay(result.join(""));
    if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    else setDisplay(TARGET);
  }, [duration]);

  useEffect(() => {
    if (!trigger) {
      setDisplay(TARGET.split("").map(() => BINARY_CHARS[Math.floor(Math.random() * 2)]).join(""));
      return;
    }
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [trigger, animate]);

  return display;
}

function FadeBlock({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function derivePremium(spot: number, side: "buy" | "sell", buyStrike: number, sellStrike: number): number {
  const basePremiumBuy = Math.round(buyStrike * 0.025);
  const basePremiumSell = Math.round(sellStrike * 0.015);

  if (!Number.isFinite(spot)) return side === "buy" ? basePremiumBuy : basePremiumSell;

  if (side === "buy") {
    const dist = Math.max(0, (spot - buyStrike) / spot);
    return Math.round(Math.max(1, basePremiumBuy * (1 + dist)));
  } else {
    const dist = Math.max(0, (sellStrike - spot) / spot);
    return Math.round(Math.max(1, basePremiumSell * (1 + dist)));
  }
}

function AnimatedPremium({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  if (value !== prevRef.current) {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    const duration = 500;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animate);
  }

  return <>${display}</>;
}

/* ── X (Twitter) icon ── */

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Header logo with binary scramble ── */

function HeaderLogo() {
  const [trigger, setTrigger] = useState(false);
  const display = useBinaryReveal(trigger, 1500);

  useEffect(() => {
    // Start scramble after a short delay on mount
    const timer = setTimeout(() => setTrigger(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const renderChars = display.split("").map((char, i) => {
    const isResolved = char === TARGET[i];
    const isCyanOne = isResolved && char === "1";
    return (
      <span
        key={i}
        style={{
          color: isCyanOne ? "var(--accent)" : isResolved ? "var(--bone)" : "var(--accent)",
          opacity: isResolved ? 1 : 0.5,
          filter: isCyanOne ? "drop-shadow(0 0 8px rgba(34,211,238,0.4))" : "none",
          transition: isResolved ? "opacity 0.3s" : undefined,
        }}
      >
        {char}
      </span>
    );
  });

  return (
    <span
      className="text-2xl font-bold tracking-tight select-none"
      style={{ fontFamily: WORDMARK_FONT }}
    >
      {renderChars}
    </span>
  );
}

/* ── Section 1: Income Hero ── */

function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-6 relative z-[3]">
      <div className="max-w-5xl mx-auto w-full">
        {/* Line 1: short, punchy, large */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-[clamp(2.2rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-[var(--bone)] font-light"
        >
          Turn volatility into income.
        </motion.h1>

        {/* Line 2: supporting, slightly smaller */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-4 text-[clamp(1.3rem,3.5vw,2rem)] leading-[1.2] text-[var(--text-secondary)] font-light"
        >
          You set the terms. The market moves. You already know the outcome.
        </motion.p>

        {/* Agent tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mt-8 font-mono text-[clamp(0.75rem,1.2vw,0.85rem)] text-[var(--accent)] tracking-[0.15em] uppercase"
        >
          humans use the app{" "}
          <span className="text-[var(--text-secondary)] opacity-40 mx-1">/</span>{" "}
          agents use the API{" "}
          <span className="text-[var(--text-secondary)] opacity-40 mx-1">/</span>{" "}
          one protocol
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="flex flex-wrap gap-4 mt-12"
        >
          <Link
            href="/earn"
            className="rounded-xl px-8 py-3.5 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Launch App
          </Link>
          <a
            href="#mechanism"
            className="rounded-xl px-8 py-3.5 text-base font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
          >
            See how it works &darr;
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.span
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-[var(--text-secondary)] text-2xl block"
        >
          &darr;
        </motion.span>
      </motion.div>
    </section>
  );
}

/* ── Section 2: Problem ── */

const PAIN_CARDS = [
  {
    title: "Lending",
    body: "2-4% APY. Safe, but barely keeps up with inflation.",
  },
  {
    title: "Staking",
    body: "3% a year. Predictable, but the market moves more in an afternoon.",
  },
  {
    title: "LP positions",
    body: "Uniswap, Pendle. Higher returns until impermanent loss and complexity eat the gains.",
  },
  {
    title: "Leveraged trading",
    body: "Futures promise big returns. Liquidations deliver big losses.",
  },
];

function ProblemSection() {
  return (
    <section className="py-24 relative z-[3] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-14">
        <FadeBlock>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight leading-[1.1]">
            DeFi income has been stuck.
          </h2>
          <p className="mt-4 text-xl text-[var(--text-secondary)]">
            Too little, too complex, or too risky. Pick two.
          </p>
        </FadeBlock>
      </div>

      {/* Auto-scrolling marquee */}
      <div className="relative overflow-hidden">
        <div className="flex gap-5 marquee-track">
          {[...PAIN_CARDS, ...PAIN_CARDS, ...PAIN_CARDS].map((card, i) => (
            <div
              key={i}
              className="w-[300px] sm:w-[360px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-7 space-y-3 hover:border-[var(--text-secondary)]/40 transition-colors"
            >
              <h3 className="text-[var(--bone)] font-medium text-lg">{card.title}</h3>
              <p className="text-[var(--text-secondary)] text-base leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--bg)] to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none" />
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-14">
        <FadeBlock delay={0.3}>
          <p className="text-[clamp(1.3rem,2.5vw,1.8rem)] font-medium text-[var(--accent)]">
            There&apos;s a better way to put your crypto to work.
          </p>
        </FadeBlock>
      </div>
    </section>
  );
}

/* ── Section 3: The Mechanism ── */

function SideToggle({ side, onSideChange }: { side: "buy" | "sell"; onSideChange: (s: "buy" | "sell") => void }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex w-fit">
      <button
        onClick={() => onSideChange("buy")}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "buy"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have USD
      </button>
      <button
        onClick={() => onSideChange("sell")}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "sell"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have OKB
      </button>
    </div>
  );
}

function MechanismSection({
  side,
  onSideChange,
  spot,
  buyStrike,
  sellStrike,
  priceReady,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  spot: number;
  buyStrike: number;
  sellStrike: number;
  priceReady: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const strike = side === "buy" ? buyStrike : sellStrike;
  const premium = derivePremium(spot, side, buyStrike, sellStrike);

  return (
    <section id="mechanism" ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: controls + explanation */}
        <div className="space-y-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight"
          >
            Here&apos;s how it works.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-[var(--text-secondary)] text-lg">
                OKB is{" "}
                {priceReady ? (
                  <span className="text-[var(--text)] font-bold font-mono">${spot.toLocaleString()}</span>
                ) : (
                  <span className="inline-block w-20 h-6 rounded bg-[var(--border)] animate-pulse align-middle" />
                )}
              </p>
              <SideToggle side={side} onSideChange={onSideChange} />
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={side}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-xl text-[var(--text-secondary)]"
              >
                You set: <span className="text-[var(--text)]">{side === "buy" ? "Buy" : "Sell"} OKB at ${strike.toLocaleString()}</span>
                <br />
                You receive: <span className="font-semibold text-[var(--accent)]"><AnimatedPremium value={premium} /></span> upfront
              </motion.p>
            </AnimatePresence>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-[var(--text-secondary)] opacity-60 text-sm"
          >
            Locked until expiry. Only the closing price matters.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="pt-4 border-t border-[var(--border)] space-y-2"
          >
            <p className="text-sm text-[var(--text-secondary)] uppercase tracking-wider">
              Where does the money come from?
            </p>
            <p className="text-[var(--text-secondary)]">
              You set a price, someone pays to lock it in. You get paid upfront, every time.
            </p>
            <p className="text-sm font-medium text-[var(--accent)]">
              Not token rewards. Real market income.
            </p>
          </motion.div>
        </div>

        {/* Right: outcome card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-5 sm:p-8 space-y-6"
          >
            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">Price {side === "buy" ? "drops" : "rises"}</p>
              <p className="text-xl text-[var(--text)] font-light">
                {side === "buy"
                  ? `You buy OKB at $${strike.toLocaleString()}.`
                  : `You sell OKB at $${strike.toLocaleString()}.`}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">It {side === "buy" ? "doesn't drop" : "doesn't rise"}</p>
              <p className="text-xl text-[var(--text)] font-light">
                {side === "buy"
                  ? `Your $${strike.toLocaleString()} comes back.`
                  : "Your OKB comes back."}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <p className="text-lg font-medium text-[var(--accent)]">
              Either way: +${premium} earned.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ── Section 3: The Loop ── */

type LoopFrame = {
  text: string;
  accent?: boolean;
  counter?: number;
  pulse?: boolean;
  secondary?: boolean;
  slow?: boolean;
};

function buildLoopFrames(
  side: "buy" | "sell",
  buyStrike: number,
  sellStrike: number,
  buyPremium: number,
  sellPremium: number,
): LoopFrame[] {
  const bs = `$${buyStrike.toLocaleString()}`;
  const ss = `$${sellStrike.toLocaleString()}`;
  const bp = buyPremium;
  const sp = sellPremium;

  if (side === "buy") return [
    { text: `Buy OKB @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price didn't hit.\n${bs} back.`, secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Buy OKB @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price hit.\nYou bought OKB @ ${bs}.`, secondary: true },
    { text: "You now have OKB.\nSet a sell price.", slow: true },
    { text: `Sell OKB @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: "Earn again →", accent: true, pulse: true },
  ];

  return [
    { text: `Sell OKB @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: "Price didn't hit.\nYour OKB comes back.", secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Sell OKB @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: `Price hit.\nYou sold OKB @ ${ss}.`, secondary: true },
    { text: "You now have dollars.\nSet a buy price.", slow: true },
    { text: `Buy OKB @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: "Earn again →", accent: true, pulse: true },
  ];
}

function LoopCounter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return <>${val}</>;
}

const LoopSection = memo(function LoopSection({
  side,
  buyStrike,
  sellStrike,
  spotBase,
}: {
  side: "buy" | "sell";
  buyStrike: number;
  sellStrike: number;
  spotBase: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [frameIndex, setFrameIndex] = useState(0);
  const buyPremium = derivePremium(spotBase, "buy", buyStrike, sellStrike);
  const sellPremium = derivePremium(spotBase, "sell", buyStrike, sellStrike);
  const frames = useMemo(
    () => buildLoopFrames(side, buyStrike, sellStrike, buyPremium, sellPremium),
    [side, buyStrike, sellStrike, buyPremium, sellPremium],
  );

  useEffect(() => {
    setFrameIndex(0);
  }, [side]);

  useEffect(() => {
    if (!inView) return;
    const duration = frames[frameIndex]?.slow ? 2500 : 2000;
    const timer = setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [inView, frameIndex, frames]);

  const frame = frames[frameIndex];

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <FadeBlock>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight">
            Every outcome earns.
          </h2>
        </FadeBlock>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-5 sm:p-10 min-h-[160px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${side}-${frameIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-1"
            >
              {frame.text.split("\n").map((line, i) => (
                <p
                  key={i}
                  className={`text-[clamp(1.3rem,3.5vw,2.2rem)] leading-relaxed ${
                    frame.accent
                      ? "font-semibold text-[var(--accent)]"
                      : frame.secondary
                        ? "text-[var(--text-secondary)] font-light"
                        : "text-[var(--text)] font-light"
                  }`}
                >
                  {frame.counter && i === 0 ? (
                    <>Earn <LoopCounter target={frame.counter} /> {"✓"}</>
                  ) : frame.pulse ? (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {line}
                    </motion.span>
                  ) : (
                    line
                  )}
                </p>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <FadeBlock delay={0.2}>
          <p className="text-center text-[var(--text-secondary)] text-lg">
            Real earnings. Paid upfront. Every cycle.
          </p>
        </FadeBlock>
      </div>
    </section>
  );
});

/* ── Section 4: Comparison ── */

const COMPARISONS = [
  { name: "Savings account", apr: "~4%", pros: ["Safe"], cons: ["Not crypto"] },
  { name: "Staking OKB", apr: "~3.5%", pros: ["Passive"], cons: ["Low income"] },
  { name: "Lending (Aave)", apr: "~2%", pros: ["DeFi"], cons: ["Lower income"] },
];

const ComparisonSection = memo(function ComparisonSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight"
        >
          How does this compare?
        </motion.h2>

        <div className="space-y-3">
          {COMPARISONS.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex items-center justify-between py-4 border-b border-[var(--border)]"
            >
              <span className="text-[var(--text-secondary)] text-base sm:text-lg">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--text-secondary)] text-base sm:text-lg font-light">{item.apr}</span>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  {item.pros.map((p) => (
                    <span key={p} className="text-[var(--text-secondary)] opacity-60">{"✓"} {p}</span>
                  ))}
                  {item.cons.map((c) => (
                    <span key={c} className="text-[var(--text-secondary)] opacity-50">{"✗"} {c}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}

          {/* b1nary row — highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-between py-5 rounded-xl px-4 -mx-4 bg-[var(--accent)]/6 border-b border-[var(--accent)]/15"
          >
            <span className="text-[var(--bone)] text-base sm:text-lg font-medium font-mono">b<span className="text-[var(--accent)]">1</span>nary</span>
            <div className="flex items-center gap-4">
              <span className="text-lg sm:text-xl font-semibold text-[var(--accent)]">15–60%</span>
              <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--accent)]">
                <span>{"✓"} Passive</span>
                <span>{"✓"} Paid upfront</span>
                <span>{"✓"} Keep your crypto</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

/* ── Section 7: Engine ── */

const ENGINE_CARDS = [
  {
    title: "Earn from prices",
    badge: "live",
    body: "Pick a price. Get paid upfront. Trade at your terms or get your capital back.",
  },
  {
    title: "Earn from movement",
    badge: "coming soon",
    body: "Earn when the market moves in either direction. No prediction needed.",
  },
  {
    title: "Trade direction, capped risk",
    badge: "coming soon",
    body: "Get exposure without liquidation risk. Max loss known before you enter.",
  },
  {
    title: "Amplify your income",
    badge: "coming soon",
    body: "Earn on larger positions from the same deposit. Protocol handles the leverage.",
  },
];

function EngineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="py-32 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-6xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight"
        >
          One engine. Multiple ways to earn.
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ENGINE_CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              className={`rounded-xl border p-6 space-y-3 transition-all duration-300 ${
                card.badge === "live"
                  ? "border-[var(--accent)]/30 bg-[var(--surface)] shadow-[0_0_20px_rgba(34,211,238,0.06)] hover:border-[var(--accent)]/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-secondary)]/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[var(--bone)] font-medium text-base">{card.title}</h3>
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-mono ${
                    card.badge === "live"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)] shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                      : "bg-[var(--border)] text-[var(--text-secondary)]"
                  }`}
                >
                  {card.badge}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-[var(--text-secondary)] opacity-60 text-base text-center"
        >
          Same protocol. Same contracts. New products are configuration, not complexity.
        </motion.p>
      </div>
    </section>
  );
}

/* ── Section 8: Social Proof ── */

const STATS = [
  { label: "Built on", value: "X Layer" },
  { label: "Backed", value: "100%" },
  { label: "Margin calls", value: "None" },
];

const SocialProofSection = memo(function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="py-24 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[var(--text)] tracking-tight text-center"
        >
          Fully collateralized. No margin. No liquidations.
        </motion.h2>

        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="text-center"
            >
              <p className="text-xl sm:text-3xl font-semibold text-[var(--bone)] font-mono">{stat.value}</p>
              <p className="text-sm text-[var(--text-secondary)] opacity-60 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center text-[var(--text-secondary)] opacity-50 text-sm"
        >
          Open source · Live on X Layer
        </motion.p>
      </div>
    </section>
  );
});

/* ── Section 6: Agent-Native ── */

function AgentNativeSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="py-24 px-6 relative z-[3]">
      <div className="max-w-6xl mx-auto space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight leading-[1.1]"
        >
          Same protocol. Any interface.
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
        {/* Left: terminal (wider) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
        >
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
          </div>

          <div className="px-5 sm:px-6 py-6 font-mono text-[clamp(0.75rem,1.3vw,0.9rem)] leading-relaxed space-y-4 overflow-x-auto scrollbar-hide">
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <p className="text-[var(--text-secondary)]">
                <span className="text-[var(--accent)]">$</span> human clicks &quot;Sell OKB at $85&quot;
              </p>
              <p className="text-[var(--accent)] mt-1">&gt; +$62 earned</p>
            </motion.div>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="border-t border-[var(--border)] origin-left"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <p className="text-[var(--text-secondary)]">
                <span className="text-[var(--accent)]">$</span> agent POST /execute &#123;asset: &quot;OKB&quot;, price: 85, side: &quot;sell&quot;&#125;
              </p>
              <p className="text-[var(--accent)] mt-1">&gt; +$62 earned</p>
            </motion.div>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 0.4, delay: 0.85 }}
              className="border-t border-[var(--border)] origin-left"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4, delay: 1.0 }}
            >
              <p className="text-[var(--text-secondary)]">
                <span className="text-[var(--accent)]">$</span> agent POST /provide &#123;asset: &quot;OKB&quot;, quotes: [...]&#125;
              </p>
              <p className="text-[var(--accent)] mt-1">&gt; Liquidity published. Earning fees on every trade.</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Right: punchline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="lg:col-span-2 space-y-4"
        >
          <p className="text-[clamp(1.3rem,2.5vw,1.8rem)] text-[var(--bone)] font-light leading-snug">
            Trade or provide liquidity.
            <br />
            Human or agent.
          </p>
          <p className="text-[var(--text-secondary)] opacity-60 text-base">
            Every side of the protocol, open to both.
          </p>
        </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── Section 7: CTA ── */

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-[70vh] flex items-center justify-center px-6 relative z-[3]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl w-full text-center space-y-10"
      >
        <h2 className="text-[clamp(2.5rem,8vw,6rem)] text-[var(--bone)] leading-[0.95] tracking-tight font-light">
          Set your price.
          <br />
          Get paid.
        </h2>

        <Link
          href="/earn"
          className="inline-block rounded-xl px-10 py-4 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Start earning &rarr;
        </Link>
      </motion.div>
    </section>
  );
}

/* ── AI CTA ── */

function AiCtaSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [copied, setCopied] = useState(false);

  return (
    <section ref={ref} className="py-16 px-6 relative z-[3]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center space-y-4"
      >
        <p className="text-lg text-[var(--bone)] font-light">
          Use an AI assistant? Give it full context on b1nary.
        </p>
        <button
          onClick={() => {
            const url = `${window.location.origin}/llms.txt`;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors"
        >
          {copied ? "Copied!" : "Copy llms.txt link"}
        </button>
      </motion.div>
    </section>
  );
}

/* ── Main ── */

export function LandingPage() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const { prices, loading: priceLoading } = usePrices(undefined, 30_000);
  const { spot: liveSpot, loading: spotLoading } = useSpot("okb", 30_000);
  const quoteSpot = prices[0]?.spot;
  const spot = liveSpot ? Math.round(liveSpot) : quoteSpot ? Math.round(quoteSpot) : FALLBACK_SPOT;
  const priceReady = spot !== FALLBACK_SPOT || (!priceLoading && !spotLoading);
  const { buyStrike, sellStrike } = useMemo(() => deriveStrikes(spot), [spot]);

  return (
    <div className="bg-[var(--bg)] relative overflow-hidden">
      {/* Global background layers */}
      <BackgroundEffects />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 lg:px-16 py-5 flex items-center justify-between">
        <HeaderLogo />
        <div className="flex items-center gap-4">
          <a
            href="https://docs.b1nary.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Docs
          </a>
          <a
            href="https://x.com/b1naryapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="b1nary on X"
            className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </a>
          <Link
            href="/earn"
            className="rounded-lg px-4 py-3 text-sm font-medium border text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]/60 transition-all"
          >
            Launch App &rarr;
          </Link>
        </div>
      </header>

      <main>
        <HeroSection />
        <div className="max-w-6xl mx-auto px-6"><div className="border-t border-[var(--border)]/50" /></div>
        <ProblemSection />
        <EngineSection />
        <MechanismSection side={side} onSideChange={setSide} spot={spot} buyStrike={buyStrike} sellStrike={sellStrike} priceReady={priceReady} />
        <LoopSection side={side} buyStrike={buyStrike} sellStrike={sellStrike} spotBase={spot} />
        <ComparisonSection />
        <AgentNativeSection />
        <SocialProofSection />
        <CTASection />
        <AiCtaSection />
      </main>

      <footer className="relative z-[3] border-t border-[var(--border)] px-6 py-8 flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)] opacity-50 font-mono">
          © {new Date().getFullYear()} b1nary
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.b1nary.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            Docs
          </a>
          <a
            href="https://x.com/b1naryapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="b1nary on X"
            className="text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            <XIcon className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}
