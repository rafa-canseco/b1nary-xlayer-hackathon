import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Your Positions",
  description:
    "Track your active options positions, premiums earned, and settlement history on b1nary.",
  openGraph: {
    title: "Your Positions | b1nary",
    description:
      "Track your active options positions, premiums earned, and settlement history on b1nary.",
  },
};

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
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
