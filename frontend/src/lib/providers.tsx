"use client";

import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { Attribution } from "ox/erc8021";
import { CHAIN, IS_XLAYER } from "@/lib/contracts";
import { SOLANA_RPC_URL } from "@/lib/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

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
          walletChainType: IS_XLAYER
            ? "ethereum-only"
            : "ethereum-and-solana",
        },
        ...(!IS_XLAYER && {
          externalWallets: {
            solana: { connectors: toSolanaWalletConnectors() },
          },
        }),
        supportedChains: [CHAIN],
        ...(!IS_XLAYER && {
          solana: {
            rpcs: {
              "solana:devnet": {
                rpc: createSolanaRpc(
                  SOLANA_RPC_URL || "https://api.devnet.solana.com",
                ),
                rpcSubscriptions: createSolanaRpcSubscriptions(
                  "wss://api.devnet.solana.com",
                ),
              },
            },
          },
        }),
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: { createOnLogin: "all-users" },
          ...(!IS_XLAYER && {
            solana: { createOnLogin: "all-users" as const },
          }),
        },
        plugins,
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
