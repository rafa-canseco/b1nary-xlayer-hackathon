"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function StrikethroughLine({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10%" });

  return (
    <div ref={ref} className="relative inline-block">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 0.5, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.5, delay, ease: "easeOut" }}
        className="text-[var(--text-secondary)]"
      >
        {children}
      </motion.span>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.4, delay: delay + 0.3, ease: "easeOut" }}
        className="absolute left-0 right-0 top-1/2 h-[2px] bg-[var(--danger)] origin-left"
      />
    </div>
  );
}
