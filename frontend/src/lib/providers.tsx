"use client";

import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";

import { Attribution } from "ox/erc8021";
import { CHAIN } from "@/lib/contracts";

function getPrivyAppId(): string {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to your .env.local file.",
    );
  }
  return id;
}

const PRIVY_APP_ID = getPrivyAppId();

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
const plugins = BUILDER_CODE
  ? [dataSuffix(Attribution.toDataSuffix({ codes: [BUILDER_CODE] }))]
  : [];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#22D3EE",
          walletChainType: "ethereum-only",
        },
        supportedChains: [CHAIN],
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: { createOnLogin: "all-users" },
        },
        plugins,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
