"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const STEPS = [
  {
    title: "Set your price.",
    body: "Pick a price you'd buy or sell at. Further from current price = safer, lower premium. Or use Range to set both a lower and upper bound.",
  },
  {
    title: "Get paid upfront.",
    body: "A market maker pays you a premium immediately. This money is yours no matter what. You see the exact amount before you accept.",
  },
  {
    title: "Wait for expiry.",
    body: "Your capital is locked for the duration (e.g. 7 days). Track on the Positions page.",
  },
  {
    title: "Two outcomes (or three with Range).",
    body: "Buy: price stays above → capital back. Price drops → you buy at your price. Sell: price stays below → asset back. Price rises → you sell at your price. Range: price stays between your bounds → everything back. Either way, you keep the premium.",
  },
] as const;

const FAQS = [
  {
    q: "What's a strike price?",
    a: "The price you commit to buy or sell at. Further from current price = safer but lower premium.",
  },
  {
    q: "What's premium?",
    a: "Money paid to you upfront by the market maker. Compensation for locking capital. Yours regardless of outcome.",
  },
  {
    q: "What's Range?",
    a: "You set a lower and upper price. If the asset stays in range, all your capital comes back and you keep premium from both sides. If it moves out, you either buy (downside) or sell (upside) at the price you chose.",
  },
  {
    q: "Can I lose money?",
    a: "You always keep the premium. If you get assigned, you buy or sell at the price you chose. Your effective cost is always better than market because of the premium you earned.",
  },
  {
    q: "Who pays the premium?",
    a: "A professional market maker. They need someone on the other side of their trade. The premium is their cost, your income.",
  },
] as const;

export function HowItWorksDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How does this work?</SheetTitle>
          <SheetDescription>
            Earn premium by setting the price you&apos;d buy or sell at.
          </SheetDescription>
        </SheetHeader>

        {/* 4-step explanation */}
        <div className="px-6 space-y-5">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex items-center justify-center size-7 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-sm font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  {step.title}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-[var(--border)]" />

        {/* FAQ */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            FAQ
          </p>
          {FAQS.map((faq, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-[var(--bone)]">
                {faq.q}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
