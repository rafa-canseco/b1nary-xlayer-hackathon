import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Leaderboard | b1nary",
  description:
    "Earnings Challenge leaderboard. Compete on earning rate and OTM streak.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
