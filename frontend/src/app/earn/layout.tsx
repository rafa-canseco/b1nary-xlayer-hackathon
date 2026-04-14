import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Earn Premium",
  description:
    "Browse live strike prices and earn premium by selling covered options. Get paid upfront every time.",
  openGraph: {
    title: "Earn Premium | b1nary",
    description:
      "Browse live strike prices and earn premium by selling covered options. Get paid upfront every time.",
  },
};

export default function EarnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[var(--accent)]/10 text-center py-2 text-xs text-[var(--accent)] font-medium">
        Closed Beta
      </div>
      <NavBar />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
