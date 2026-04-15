import type { Metadata } from "next";
import TryPageClient from "./TryPageClient";

export const metadata: Metadata = {
  title: "Try the Simulator",
  description:
    "See how much you'd earn by picking a price for OKB. Interactive demo of b1nary's options strategy.",
  openGraph: {
    title: "Try the Simulator | b1nary",
    description:
      "See how much you'd earn by picking a price for OKB. Interactive demo of b1nary's options strategy.",
  },
};

export default function TryPage() {
  return <TryPageClient />;
}
