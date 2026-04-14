import {
  encodeFunctionData,
  pad,
  type Address,
} from "viem";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createApproveInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { BatchCall } from "@/hooks/useWallet";
import { CHAIN, ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { SOLANA_USDC_MINT, solanaConnection, toPublicKey } from "@/lib/solana";

// ---------------------------------------------------------------------------
// Domain IDs (Circle CCTP V2)
// ---------------------------------------------------------------------------

export const DOMAIN_BASE = 6;
export const DOMAIN_SOLANA = 5;

// ---------------------------------------------------------------------------
// Contract / Program addresses
// ---------------------------------------------------------------------------

const isMainnet = CHAIN.id === 8453;

export const CCTP_EVM = {
  tokenMessenger: (isMainnet
    ? "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"
    : "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA") as Address,
  messageTransmitter: (isMainnet
    ? "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
    : "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275") as Address,
} as const;

export const CCTP_SOLANA = {
  tokenMessengerMinter: new PublicKey(
    "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
  ),
  messageTransmitter: new PublicKey(
    "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
  ),
} as const;

// ---------------------------------------------------------------------------
// TokenMessengerV2 ABI (EVM) — only depositForBurn
// ---------------------------------------------------------------------------

export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ---------------------------------------------------------------------------
// Address format converters
// ---------------------------------------------------------------------------

/** Pad a 20-byte EVM address to 32 bytes (left-padded with zeros). */
export function evmToBytes32(addr: Address): `0x${string}` {
  return pad(addr, { size: 32 });
}

/** Convert a Solana PublicKey to a 32-byte hex string. */
export function solanaToBytes32(pubkey: PublicKey): `0x${string}` {
  return ("0x" + Buffer.from(pubkey.toBytes()).toString("hex")) as `0x${string}`;
}

/** Convert a 32-byte hex string back to a Solana PublicKey. */
export function bytes32ToSolana(bytes32: `0x${string}`): PublicKey {
  return new PublicKey(Buffer.from(bytes32.slice(2), "hex"));
}

// ---------------------------------------------------------------------------
// EVM burn builder — returns BatchCall[] for sendBatchTx()
// ---------------------------------------------------------------------------

/**
 * Build batch calls to burn USDC on Base via CCTP V2.
 * Caller must send these via `sendBatchTx()`.
 *
 * @param amount      Raw USDC amount (6 decimals)
 * @param recipient   Destination wallet (Solana pubkey as 32-byte hex)
 * @param maxFee      Max bridge fee in raw USDC. Fetch from backend.
 */
export function buildEvmBurnCalls(
  amount: bigint,
  recipient: `0x${string}`,
  maxFee: bigint,
): BatchCall[] {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CCTP_EVM.tokenMessenger, amount],
  });

  const burnData = encodeFunctionData({
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: "depositForBurn",
    args: [
      amount,
      DOMAIN_SOLANA,
      recipient,
      ADDRESSES.usdc,
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      maxFee,
      0, // minFinalityThreshold: 0 = default finality
    ],
  });

  return [
    { to: ADDRESSES.usdc, data: approveData },
    { to: CCTP_EVM.tokenMessenger, data: burnData },
  ];
}

// ---------------------------------------------------------------------------
// Solana burn builder — returns a Transaction ready for signing
// ---------------------------------------------------------------------------

/**
 * Derive a PDA with the given seeds from a program.
 * Thin wrapper around PublicKey.findProgramAddressSync.
 */
function findPda(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

/** Build the 4-byte LE buffer for a u32. */
function u32Le(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

/** Build the 8-byte LE buffer for a u64 (from bigint). */
function u64Le(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

/**
 * Derive PDAs required by the CCTP V2 Solana depositForBurn instruction.
 */
function deriveCctpPdas(
  mint: PublicKey,
  destDomain: number,
) {
  const tmm = CCTP_SOLANA.tokenMessengerMinter;
  const mt = CCTP_SOLANA.messageTransmitter;

  return {
    senderAuthority: findPda(
      [Buffer.from("sender_authority")],
      tmm,
    ),
    tokenMinter: findPda(
      [Buffer.from("token_minter")],
      tmm,
    ),
    localToken: findPda(
      [Buffer.from("local_token"), mint.toBuffer()],
      tmm,
    ),
    remoteTokenMessenger: findPda(
      [Buffer.from("remote_token_messenger"), u32Le(destDomain)],
      tmm,
    ),
    authorityPda: findPda(
      [
        Buffer.from("message_transmitter_authority"),
        tmm.toBuffer(),
      ],
      mt,
    ),
    messageTransmitterConfig: findPda(
      [Buffer.from("message_transmitter")],
      mt,
    ),
  };
}

/**
 * Build a Solana Transaction to burn USDC via CCTP V2 depositForBurn.
 * Returns a Transaction ready for signing (NOT sent).
 *
 * @param ownerPubkey     User's Solana wallet (signer)
 * @param amount          Raw USDC amount (6 decimals)
 * @param evmRecipient    Destination EVM address as 32-byte hex
 * @param maxFee          Max bridge fee in raw USDC
 */
export async function buildSolanaBurnTransaction(
  ownerPubkey: PublicKey,
  amount: bigint,
  evmRecipient: `0x${string}`,
  maxFee: bigint,
): Promise<Transaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const mint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const pdas = deriveCctpPdas(mint, DOMAIN_BASE);

  const ownerAta = await getAssociatedTokenAddress(
    mint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  // Approve TokenMessengerMinter to spend USDC
  const approveIx = createApproveInstruction(
    ownerAta,
    pdas.senderAuthority,
    ownerPubkey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );

  // CCTP V2 depositForBurn instruction data (Anchor convention):
  // sha256("global:deposit_for_burn")[0..8] + Borsh-encoded args.
  // Verify against on-chain IDL during devnet testing.
  const discriminator = Buffer.from(
    "d73c3d2e723780b0", "hex",
  );
  const recipientBytes = Buffer.from(evmRecipient.slice(2), "hex");
  const destCallerBytes = Buffer.alloc(32); // zero = anyone can relay

  const ixData = Buffer.concat([
    discriminator,
    u64Le(amount),
    u32Le(DOMAIN_BASE),
    recipientBytes,
    destCallerBytes,
    u64Le(maxFee),
    u32Le(0), // minFinalityThreshold
  ]);

  // Message sent event data account (ephemeral keypair).
  // The backend only needs the burnTxHash to find the attestation,
  // so we use a deterministic address derived from the owner + amount.
  const messageSentEventData = findPda(
    [
      Buffer.from("message_sent"),
      ownerPubkey.toBuffer(),
      u64Le(amount),
    ],
    CCTP_SOLANA.messageTransmitter,
  );

  const burnIx = new TransactionInstruction({
    programId: CCTP_SOLANA.tokenMessengerMinter,
    keys: [
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: pdas.senderAuthority, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: pdas.messageTransmitterConfig, isSigner: false, isWritable: true },
      { pubkey: pdas.tokenMinter, isSigner: false, isWritable: false },
      { pubkey: pdas.localToken, isSigner: false, isWritable: true },
      { pubkey: pdas.remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: pdas.authorityPda, isSigner: false, isWritable: false },
      { pubkey: messageSentEventData, isSigner: false, isWritable: true },
      { pubkey: CCTP_SOLANA.messageTransmitter, isSigner: false, isWritable: false },
      { pubkey: CCTP_SOLANA.tokenMessengerMinter, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isSigner: false,
        isWritable: false,
      },
    ],
    data: ixData,
  });

  const tx = new Transaction();
  tx.add(approveIx, burnIx);

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;

  return tx;
}
