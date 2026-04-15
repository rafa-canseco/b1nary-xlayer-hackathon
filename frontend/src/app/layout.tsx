import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "b1nary · Turn volatility into income",
    template: "%s | b1nary",
  },
  description:
    "Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents. Live on X Layer.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "base:app_id": "69a5b7c877bc7576330f4b09",
  },
  openGraph: {
    type: "website",
    siteName: "b1nary",
    title: "b1nary · Turn volatility into income",
    description:
      "Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents. Live on X Layer.",
  },
  twitter: {
    card: "summary",
    title: "b1nary · Turn volatility into income",
    description:
      "Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents. Live on X Layer.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69a5b7c877bc7576330f4b09" />
      </head>
      <body>
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
