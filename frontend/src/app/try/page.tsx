import type { Metadata } from "next";
import TryPageClient from "./TryPageClient";

export const metadata: Metadata = {
  title: "Try the Simulator",
  description:
    "See how much you'd earn by picking a price for ETH. Interactive demo of b1nary's covered options strategy.",
  openGraph: {
    title: "Try the Simulator | b1nary",
    description:
      "See how much you'd earn by picking a price for ETH. Interactive demo of b1nary's covered options strategy.",
  },
};

export default function TryPage() {
  return <TryPageClient />;
}
