"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import { createWalletClient, custom, type Address } from "viem";
import { useCallback, useMemo } from "react";
import { CHAIN } from "@/lib/contracts";

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export interface ExternalWallet {
  address: string;
  chain: "xlayer";
  name: string;
  walletClientType: string;
}

const WALLET_NAMES: Record<string, string> = {
  metamask: "MetaMask",
  coinbase_wallet: "Coinbase",
  rainbow: "Rainbow",
  phantom: "Phantom",
  privy: "Privy",
};

function prettyWalletName(raw: string): string {
  return WALLET_NAMES[raw] ?? raw;
}

export function useWallet() {
  const { logout, ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();

  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const fundingWallet = externalWallet ?? embeddedWallet;

  const address = fundingWallet?.address as Address | undefined;
  const fundingAddress = address;

  const externalWalletsList = useMemo<ExternalWallet[]>(() => {
    const list: ExternalWallet[] = [];
    if (externalWallet) {
      list.push({
        address: externalWallet.address,
        chain: "xlayer",
        name: prettyWalletName(externalWallet.walletClientType),
        walletClientType: externalWallet.walletClientType,
      });
    }
    return list;
  }, [externalWallet]);

  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<`0x${string}`> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }
      if (!fundingWallet) {
        throw new Error("No wallet connected");
      }
      await fundingWallet.switchChain(CHAIN.id);
      const provider = await fundingWallet.getEthereumProvider();
      const wc = createWalletClient({
        account: fundingWallet.address as Address,
        chain: CHAIN,
        transport: custom(provider),
      });
      console.log(
        "[sendBatchTx] EOA: sending",
        calls.length,
        "tx(s) sequentially:",
        calls.map((c) => ({ to: c.to, data: c.data.slice(0, 10) })),
      );
      let lastHash: `0x${string}` = "0x";
      for (const call of calls) {
        lastHash = await wc.sendTransaction({
          to: call.to,
          data: call.data,
          value: call.value,
        });
      }
      return lastHash;
    },
    [fundingWallet],
  );

  const sendFundingTx = useCallback(
    async (call: BatchCall): Promise<`0x${string}`> => {
      if (!fundingWallet) {
        throw new Error("No funding wallet connected");
      }
      await fundingWallet.switchChain(CHAIN.id);
      const provider = await fundingWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: fundingWallet.address as Address,
        chain: CHAIN,
        transport: custom(provider),
      });
      console.log("[sendFundingTx] EOA sending tx to", call.to);
      return walletClient.sendTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
      });
    },
    [fundingWallet],
  );

  const disconnect = useCallback(async () => {
    for (const w of wallets) {
      try {
        const provider = await w.getEthereumProvider();
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (err) {
        console.warn("[disconnect] Could not revoke permissions:", err);
      }
    }
    try {
      await logout();
    } catch (err) {
      console.error("[disconnect] logout failed:", err);
    }
  }, [wallets, logout]);

  return {
    address,
    fundingAddress,
    externalWallets: externalWalletsList,
    sendBatchTx,
    sendFundingTx,
    isConnected: !!fundingAddress,
    isReady: ready,
    connectWallet,
    disconnect,
  };
}
