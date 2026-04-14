"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

function runTour(steps: DriveStep[], onComplete: () => void) {
  const tour = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: "rgba(0, 0, 0, 0.75)",
    stagePadding: 10,
    stageRadius: 12,
    popoverClass: "b1nary-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it!",
    onDestroyStarted: () => {
      tour.destroy();
      onComplete();
    },
    steps,
  });
  tour.drive();
}

export function startBuyTour(
  symbol: string,
  onComplete: () => void,
) {
  runTour(
    [
      {
        element: "[data-tour='context-line']",
        popover: {
          title: `Buy ${symbol} cheaper`,
          description:
            `Here you can get ${symbol} at a price you choose, below market. While you wait, a market maker pays you upfront just for setting that price. Let's walk through it.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='duration']",
        popover: {
          title: "Pick a duration",
          description:
            "How long are you willing to wait? At the end of this period, one of two things happens (both are good).",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='amount']",
        popover: {
          title: "How much?",
          description:
            "Enter how much USD you want to put to work. This is what you're committing. If the price doesn't hit your target, you get it all back.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='strikes']",
        popover: {
          title: "Pick your price",
          description:
            `At what price would you buy ${symbol}? Closer to market pays more but is more likely to execute. Further away is safer but pays less.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='outcome-otm']",
        popover: {
          title: "If the price doesn't hit",
          description:
            "When the duration ends and the price didn't reach your target, your dollars come back. Remember: you already collected the earnings the moment you accepted. They're yours no matter what.",
          side: "left" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='outcome-itm']",
        popover: {
          title: "If the price hits",
          description:
            `You buy ${symbol} at the price you chose. You already collected the earnings when you accepted, so those are yours too. This is not a loss. You got ${symbol} at your price.`,
          side: "left" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='tab-sell']",
        popover: {
          title: "Then come here",
          description:
            `After you buy ${symbol}, switch to this tab. Set a sell price above what you paid. You'll collect another payment upfront, and when you sell, you sell higher than you bought. Earnings from both sides + buy low, sell high.`,
          side: "bottom" as const,
          align: "center" as const,
        },
      },
      {
        element: "[data-tour='accept']",
        popover: {
          title: "You're ready",
          description:
            "Pick your values above and hit Accept to start earning.",
          side: "top" as const,
          align: "center" as const,
        },
      },
    ],
    onComplete,
  );
}

export function startSellTour(
  symbol: string,
  onComplete: () => void,
) {
  runTour(
    [
      {
        element: "[data-tour='context-line']",
        popover: {
          title: `Sell ${symbol} higher`,
          description:
            `Already holding ${symbol}? Set a sell price above market. A market maker pays you upfront for that commitment. If the price never gets there, you keep your ${symbol} and the payment. Let's walk through it.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='duration']",
        popover: {
          title: "Pick a duration",
          description:
            "How long are you willing to wait? At the end, one of two things happens (both are good).",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='amount']",
        popover: {
          title: "How much?",
          description:
            `Enter how much ${symbol} you want to put to work. If the price doesn't hit your target, your ${symbol} comes right back.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='strikes']",
        popover: {
          title: "Pick your sell price",
          description:
            `At what price would you sell ${symbol}? Closer to market pays more. Further away is safer. You decide.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='outcome-otm']",
        popover: {
          title: "If the price doesn't hit",
          description:
            `When the duration ends and the price didn't reach your target, your ${symbol} comes back. Remember: you already collected the earnings the moment you accepted. They're yours no matter what.`,
          side: "left" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='outcome-itm']",
        popover: {
          title: "If the price hits",
          description:
            `You sell ${symbol} at the price you chose. You already collected the earnings when you accepted, so those are yours too. You sold at your price, and now you have dollars.`,
          side: "left" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='tab-buy']",
        popover: {
          title: "Then come here",
          description:
            `After you sell ${symbol}, switch to this tab. Set a buy price below what you sold at. You'll collect another payment upfront, and when you buy back, you get ${symbol} cheaper than you sold it. Earnings from both sides + sell high, buy low.`,
          side: "bottom" as const,
          align: "center" as const,
        },
      },
      {
        element: "[data-tour='accept']",
        popover: {
          title: "You're ready",
          description:
            "Pick your values above and hit Accept to start earning.",
          side: "top" as const,
          align: "center" as const,
        },
      },
    ],
    onComplete,
  );
}

export function startRangeTour(
  symbol: string,
  onComplete: () => void,
) {
  runTour(
    [
      {
        element: "[data-tour='context-line']",
        popover: {
          title: "Earn from both sides",
          description:
            `Set a buy price and a sell price around ${symbol}. You get paid from both commitments. If ${symbol} stays in your range, everything comes back and you keep both payments. Let's set it up.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='range-amount']",
        popover: {
          title: "How much?",
          description:
            "Enter the total USD you want to commit. We split it automatically between the buy side and sell side.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='range-strikes']",
        popover: {
          title: "Pick your range",
          description:
            `Choose a lower price (where you'd buy ${symbol}) and an upper price (where you'd sell). Wider range = safer. Tighter range = more earnings.`,
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='range-outcomes']",
        popover: {
          title: "Three outcomes, all earn",
          description:
            `If ${symbol} stays in range: everything back + keep both payments. If it drops: you buy ${symbol} cheap, keep the payments, then sell it higher. If it rises: you sell ${symbol} at your price, keep the payments, then buy it back cheaper.`,
          side: "left" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='range-accept']",
        popover: {
          title: "You're ready",
          description:
            "Pick your range above and hit Accept to start earning from both sides.",
          side: "top" as const,
          align: "center" as const,
        },
      },
    ],
    onComplete,
  );
}
