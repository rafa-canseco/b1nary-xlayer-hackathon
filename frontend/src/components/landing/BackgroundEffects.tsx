"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CursorGlow } from "./CursorGlow";

const DEFI_SYMBOLS = [
  "0", "1", "$", "ETH", "%", "0", "1",
  "$2,400", "$2,800", "0", "1", "+$42", "+$61",
  "0", "1", "7d", "38%", "0", "1", "$", "ETH",
  "BTC", "SOL", "AAPL", "TSLA", "GOLD", "SPY",
  "$68,200", "$142", "$185", "$2,650", "NVDA",
  "EUR/USD", "GBP", "JPY", "OIL", "AMZN",
  "+12%", "-3.2%", "+$180", "+$24", "$420",
  "14d", "30d", "7d", "1d", "90d",
  "GOOG", "MSFT", "ARB", "OP", "LINK",
  "$3,200", "$95,400", "$310", "AVAX", "UNI",
];

function DefiRain() {
  const [columns, setColumns] = useState<
    { x: number; chars: string[]; speed: number; isDefi: boolean[] }[]
  >([]);

  useEffect(() => {
    setColumns(
      Array.from({ length: 30 }, (_, i) => {
        const chars = Array.from(
          { length: 12 + Math.floor(Math.random() * 16) },
          () => DEFI_SYMBOLS[Math.floor(Math.random() * DEFI_SYMBOLS.length)]
        );
        return {
          x: (i / 30) * 100 + Math.random() * 2,
          chars,
          speed: 10 + Math.random() * 18,
          isDefi: chars.map((c) => c.length > 1 || c === "$" || c === "%"),
        };
      })
    );
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-[1]">
      {columns.map((col, i) => (
        <motion.div
          key={i}
          className="absolute font-mono text-sm leading-relaxed"
          style={{ left: `${col.x}%`, opacity: 0.5 }}
          initial={{ y: "-100%" }}
          animate={{ y: "120vh" }}
          transition={{ duration: col.speed, repeat: Infinity, ease: "linear", delay: Math.random() * 6 }}
        >
          {col.chars.map((c, j) => (
            <div
              key={j}
              className={col.isDefi[j] ? "text-[var(--accent)] font-semibold text-base" : "text-[var(--accent)]"}
              style={{ opacity: col.isDefi[j] ? 0.9 : 0.4 }}
            >
              {c}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

function MouseSpotlight({ radius = 280 }: { radius?: number }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    let mouseX = -1000;
    let mouseY = -1000;
    let currentX = -1000;
    let currentY = -1000;
    let frame: number;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const onLeave = () => { mouseX = -1000; mouseY = -1000; };

    const lerp = () => {
      currentX += (mouseX - currentX) * 0.1;
      currentY += (mouseY - currentY) * 0.1;
      el.style.background = `radial-gradient(circle ${radius}px at ${currentX}px ${currentY}px, transparent 0%, rgba(10,10,10,0.92) 100%)`;
      frame = requestAnimationFrame(lerp);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    frame = requestAnimationFrame(lerp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [radius]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[2] pointer-events-none"
      style={{ background: "rgba(10,10,10,0.92)" }}
    />
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        animate={{
          x: [0, 80, -40, 60, 0],
          y: [0, -60, 40, -30, 0],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)",
        }}
      />
      <motion.div
        animate={{
          x: [0, -60, 30, -50, 0],
          y: [0, 50, -40, 20, 0],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/3 -left-48 w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)",
        }}
      />
      <motion.div
        animate={{
          x: [0, 40, -60, 20, 0],
          y: [0, -30, 50, -60, 0],
          scale: [1, 1.1, 0.85, 1.05, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.03) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function BackgroundEffects() {
  return (
    <>
      <DefiRain />
      <MouseSpotlight />
      <FloatingOrbs />
      <CursorGlow />
    </>
  );
}
