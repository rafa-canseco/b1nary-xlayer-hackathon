/**
 * Trade tx builders for the bridge-and-trade flow.
 *
 * Direction-dependent signing strategy:
 *
 * Base → Solana:
 *   - Burn: smart wallet sends on Base
 *   - Trade: Solana embedded wallet signs (NOT sends) — backend submits
 *
 * Solana → Base:
 *   - Burn: Solana embedded wallet sends
 *   - Trade: frontend waits for backend mint, then calls sendBatchTx()
 *     directly (the Privy smart wallet doesn't support sign-without-send
 *     for ERC-4337 UserOps)
 */
import {
  maxUint256,
  encodeFunctionData,
} from "viem";
import {
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createApproveInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PriceQuote } from "@/lib/api";
import type { BatchCall } from "@/hooks/useWallet";
import { ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { SOLANA_USDC_MINT, SOLANA_WSOL_MINT, solanaConnection, toPublicKey } from "@/lib/solana";
import { encodeExecuteOrder, computeCollateral } from "@/lib/execution";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require("bs58");

// ---------------------------------------------------------------------------
// Solana b1nary program addresses (from CONTEXT.md — devnet)
// ---------------------------------------------------------------------------

const SOLANA_PROGRAMS = {
  batchSettler: new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_BATCH_SETTLER ??
      "GpR6id2cHu5fUGsFm7NUKkB4NzfuEDa6brPzkSrgAzvS",
  ),
  marginPool: new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_MARGIN_POOL ??
      "Hp7XDp9USyoid2f7cJKPxmDrvHM2D8izeeGzkViPiy5r",
  ),
  controller: new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_CONTROLLER ??
      "FH3z4BYRZMFU8YzpJoFXUbrdoYksdERnWbZvDAEc3qcC",
  ),
} as const;

const SOLANA_ALT_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_ALT_ADDRESS ?? "";
const SOLANA_USDC_POOL_TOKEN_ACCOUNT =
  process.env.NEXT_PUBLIC_SOLANA_USDC_POOL_TOKEN_ACCOUNT ??
  "Gd27sN9HKzBhQmedn6twMTmqSvsHqzSWhTcBt7nnz2hx";
const SOLANA_WSOL_POOL_TOKEN_ACCOUNT =
  process.env.NEXT_PUBLIC_SOLANA_WSOL_POOL_TOKEN_ACCOUNT ??
  "5n8CAf7wYuAdqcc1kLy2peGLFAAaBCvvbvtpaA3VXRhg";

let cachedAlt: AddressLookupTableAccount | null = null;

async function loadAlt(
  connection: import("@solana/web3.js").Connection,
): Promise<AddressLookupTableAccount> {
  if (cachedAlt) return cachedAlt;
  if (!SOLANA_ALT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_SOLANA_ALT_ADDRESS not set");
  }
  const resp = await connection.getAddressLookupTable(
    new PublicKey(SOLANA_ALT_ADDRESS),
  );
  if (!resp.value) {
    throw new Error(`ALT ${SOLANA_ALT_ADDRESS} not found on-chain`);
  }
  cachedAlt = resp.value;
  return cachedAlt;
}

async function findControllerPoolTokenAccount(
  mint: PublicKey,
  poolVaultAuthority: PublicKey,
  usdcMint: PublicKey,
  wsolMint: PublicKey,
): Promise<PublicKey> {
  if (mint.equals(usdcMint) && SOLANA_USDC_POOL_TOKEN_ACCOUNT) {
    return toPublicKey(
      SOLANA_USDC_POOL_TOKEN_ACCOUNT,
      "Solana USDC pool token account",
    );
  }
  if (mint.equals(wsolMint) && SOLANA_WSOL_POOL_TOKEN_ACCOUNT) {
    return toPublicKey(
      SOLANA_WSOL_POOL_TOKEN_ACCOUNT,
      "Solana wSOL pool token account",
    );
  }
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }

  const accounts = await solanaConnection.getTokenAccountsByOwner(
    poolVaultAuthority,
    { mint },
  );
  if (accounts.value.length > 0) {
    return accounts.value[0].pubkey;
  }

  return getAssociatedTokenAddress(
    mint,
    poolVaultAuthority,
    true,
    TOKEN_PROGRAM_ID,
  );
}

// ---------------------------------------------------------------------------
// EVM: Build batch calls for approve + executeOrder on Base
// ---------------------------------------------------------------------------

/**
 * Build the batch calls for an EVM trade (approve + executeOrder).
 * Used for Solana→Base direction: after backend mints USDC to the
 * smart wallet, the frontend calls sendBatchTx() with these calls.
 */
export function buildEvmTradeCalls(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
): BatchCall[] {
  const { oTokenAmount, collateral, collateralAsset } =
    computeCollateral(isBuy, amount, quote.strike, assetSlug);

  const calls: BatchCall[] = [];

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ADDRESSES.marginPool, maxUint256],
  });
  calls.push({ to: collateralAsset, data: approveData });

  const executeData = encodeExecuteOrder(quote, oTokenAmount, collateral);
  calls.push({ to: ADDRESSES.batchSettler, data: executeData });

  return calls;
}

// ---------------------------------------------------------------------------
// Solana: Build Transactions
// ---------------------------------------------------------------------------

/**
 * Build a small sponsored transaction to wrap native SOL into the user's wSOL
 * ATA before executeOrder. Keeping this separate avoids pushing the sponsored
 * executeOrder v0 transaction over Solana's 1232-byte size limit.
 */
export async function buildWrapSolTransaction(
  ownerPubkey: PublicKey,
  lamports: bigint,
): Promise<Transaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (lamports <= BigInt(0)) {
    throw new Error("Wrap amount must be greater than zero");
  }

  const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");
  const userWsolAccount = await getAssociatedTokenAddress(
    wsolMint,
    ownerPubkey,
    false,
    TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();
  const ataInfo = await solanaConnection.getAccountInfo(userWsolAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        ownerPubkey,
        userWsolAccount,
        ownerPubkey,
        wsolMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  tx.add(
    SystemProgram.transfer({
      fromPubkey: ownerPubkey,
      toPubkey: userWsolAccount,
      lamports,
    }),
  );
  tx.add(createSyncNativeInstruction(userWsolAccount, TOKEN_PROGRAM_ID));

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;
  return tx;
}

export async function buildSolanaTradeSetupTransaction(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
  ownerPubkey: PublicKey,
  wrapSolLamports: bigint = BigInt(0),
  includeApprove = false,
): Promise<Transaction | null> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const { collateral } = computeCollateral(isBuy, amount, quote.strike, assetSlug);
  const collateralMint = toPublicKey(
    isBuy ? SOLANA_USDC_MINT : SOLANA_WSOL_MINT,
    "collateral mint",
  );
  const oTokenMint = toPublicKey(quote.otoken_address!, "oToken mint");

  const [settlerConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("settler_config")],
    SOLANA_PROGRAMS.batchSettler,
  );

  const userCollateralAccount = await getAssociatedTokenAddress(
    collateralMint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );
  const settlerOtokenAccount = await getAssociatedTokenAddress(
    oTokenMint, settlerConfigPda, true, TOKEN_PROGRAM_ID,
  );
  const userPremiumAccount = await getAssociatedTokenAddress(
    usdcMint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  const [
    settlerOtokenAccountInfo,
    userPremiumAccountInfo,
    userCollateralAccountInfo,
  ] = await solanaConnection.getMultipleAccountsInfo([
    settlerOtokenAccount,
    userPremiumAccount,
    userCollateralAccount,
  ]);

  const tx = new Transaction();
  if (!settlerOtokenAccountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        ownerPubkey, settlerOtokenAccount, settlerConfigPda,
        oTokenMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (!userPremiumAccountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        ownerPubkey, userPremiumAccount, ownerPubkey,
        usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (wrapSolLamports > BigInt(0)) {
    if (isBuy || assetSlug !== "sol") {
      throw new Error("SOL wrapping is only valid for Solana covered calls.");
    }
    if (!userCollateralAccountInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          userCollateralAccount,
          ownerPubkey,
          collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
    tx.add(
      SystemProgram.transfer({
        fromPubkey: ownerPubkey,
        toPubkey: userCollateralAccount,
        lamports: wrapSolLamports,
      }),
    );
    tx.add(createSyncNativeInstruction(userCollateralAccount, TOKEN_PROGRAM_ID));
  }
  if (includeApprove) {
    tx.add(createApproveInstruction(
      userCollateralAccount,
      settlerConfigPda,
      ownerPubkey,
      collateral,
      [],
      TOKEN_PROGRAM_ID,
    ));
  }

  if (tx.instructions.length === 0) {
    return null;
  }

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;
  return tx;
}

/** Build 8-byte LE buffer for a u64 (bigint). */
function u64Le(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

/**
 * Read a 32-byte pubkey from raw account data at the given byte offset.
 */
function readPubkeyAt(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.slice(offset, offset + 32));
}

function readSplTokenOwner(data: Buffer): PublicKey {
  if (data.length < 64) {
    throw new Error("SPL token account data is too short to read owner");
  }
  return readPubkeyAt(data, 32);
}

function expectedNetPremiumRaw(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
): bigint {
  const contracts = isBuy ? amount / quote.strike : amount;
  return BigInt(Math.round(contracts * quote.premium * 1e6));
}

function assertSolanaPremiumScale(
  quote: PriceQuote,
  oTokenAmount: bigint,
  amount: number,
  isBuy: boolean,
  feeBps: number,
) {
  if (!quote.bid_price_raw) return;

  // Mirrors batch_settler::compute_premium_split exactly.
  const grossRaw =
    (oTokenAmount * BigInt(quote.bid_price_raw)) / BigInt(100_000_000);
  const feeRaw = (grossRaw * BigInt(feeBps)) / BigInt(10_000);
  const netRaw = grossRaw - feeRaw;
  const expectedRaw = expectedNetPremiumRaw(quote, amount, isBuy);
  const toleranceRaw = BigInt(10_000); // 1 cent USDC
  const delta =
    netRaw > expectedRaw ? netRaw - expectedRaw : expectedRaw - netRaw;

  if (expectedRaw > BigInt(0) && delta > toleranceRaw) {
    const expectedUsd = Number(expectedRaw) / 1e6;
    const onchainUsd = Number(netRaw) / 1e6;
    throw new Error(
      "Solana quote premium mismatch. " +
        `UI shows $${expectedUsd.toFixed(2)}, but the on-chain instruction ` +
        `would pay $${onchainUsd.toFixed(2)}. ` +
        "This quote was blocked to avoid executing at the wrong amount.",
    );
  }
}


/**
 * Build a Solana Transaction for approve + executeOrder on the
 * b1nary Solana programs. Returns unsigned — caller must sign via
 * Privy's `signSolanaTransaction()`.
 *
 * Single sponsored tx containing: ATA creates (idempotent) +
 * SPL approve + Ed25519 verify + executeOrder (23 accounts).
 * Uses Address Lookup Table to compress below 1232-byte limit.
 */
export async function buildSolanaTradeTransaction(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
  ownerPubkey: PublicKey,
  /** Current wSOL balance. Calls can inline-wrap native SOL via wrapSolLamports. */
  wsolBalance?: bigint,
  wrapSolLamports: bigint = BigInt(0),
  includeSetupInstructions = true,
  includeApproveInstruction = true,
): Promise<VersionedTransaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const { oTokenAmount, collateral } =
    computeCollateral(isBuy, amount, quote.strike, assetSlug);

  // Determine collateral mint based on option type (put=USDC, call=wSOL)
  const collateralMintStr = isBuy ? SOLANA_USDC_MINT : SOLANA_WSOL_MINT;
  const collateralLabel = isBuy
    ? "USDC"
    : assetSlug === "sol"
      ? "wSOL"
      : assetSlug;
  const collateralMint = toPublicKey(collateralMintStr, "collateral mint");

  const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
  const oTokenMint = toPublicKey(quote.otoken_address!, "oToken mint");
  const makerPubkey = toPublicKey(quote.mm_address!, "maker pubkey");

  // ---------------------------------------------------------------------------
  // PDAs
  // ---------------------------------------------------------------------------

  const [settlerConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("settler_config")],
    SOLANA_PROGRAMS.batchSettler,
  );

  const [makerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("maker"), makerPubkey.toBuffer()],
    SOLANA_PROGRAMS.batchSettler,
  );

  const quoteIdLe8 = u64Le(BigInt(quote.quote_id!));
  const [quoteFillPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("quote_fill"), makerPubkey.toBuffer(), quoteIdLe8],
    SOLANA_PROGRAMS.batchSettler,
  );

  const [controllerConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("controller_config")],
    SOLANA_PROGRAMS.controller,
  );

  const [vaultCounterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_counter"), settlerConfigPda.toBuffer()],
    SOLANA_PROGRAMS.controller,
  );

  const [otokenInfoPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("otoken_info"), oTokenMint.toBuffer()],
    SOLANA_PROGRAMS.controller,
  );

  const [makerOtokenBalancePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mm_balance"), makerPubkey.toBuffer(), oTokenMint.toBuffer()],
    SOLANA_PROGRAMS.batchSettler,
  );

  const [poolVaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault_auth"), collateralMint.toBuffer()],
    SOLANA_PROGRAMS.controller,
  );

  // ---------------------------------------------------------------------------
  // On-chain reads
  // ---------------------------------------------------------------------------

  // Pre-flight: verify otoken hasn't expired on-chain
  // OTokenInfo layout: discriminator(8) + otoken_mint(32) + underlying(32)
  //   + strike_asset(32) + collateral_mint(32) + strike_price(8) + expiry(8)
  const otokenInfoAccount = await solanaConnection.getAccountInfo(otokenInfoPda);
  if (!otokenInfoAccount) {
    throw new Error(
      "otoken_info account not found on-chain. " +
      "The option token has not been registered yet.",
    );
  }
  const otokenExpiry = Buffer.from(otokenInfoAccount.data)
    .readBigInt64LE(144); // offset: 8+32+32+32+32+8 = 144
  const nowUnix = BigInt(Math.floor(Date.now() / 1000));
  if (otokenExpiry <= nowUnix) {
    throw new Error(
      `Option has expired on-chain (expiry=${otokenExpiry}, now=${nowUnix}). ` +
      "Select a quote with a future expiry date.",
    );
  }

  // Read settlerConfig → treasury pubkey at offset 72 (8+32+32)
  const settlerConfigInfo = await solanaConnection.getAccountInfo(settlerConfigPda);
  if (!settlerConfigInfo) {
    throw new Error("settlerConfig account not found on-chain");
  }
  const settlerConfigData = Buffer.from(settlerConfigInfo.data);
  const treasuryPubkey = readPubkeyAt(settlerConfigData, 72);
  const protocolFeeBps = settlerConfigData.readUInt16LE(104);
  assertSolanaPremiumScale(
    quote,
    oTokenAmount,
    amount,
    isBuy,
    protocolFeeBps,
  );

  const poolTokenAccountPubkey = await findControllerPoolTokenAccount(
    collateralMint,
    poolVaultAuthorityPda,
    usdcMint,
    toPublicKey(SOLANA_WSOL_MINT, "wSOL mint"),
  );

  const poolTokenInfo = await solanaConnection.getAccountInfo(poolTokenAccountPubkey);
  if (!poolTokenInfo) {
    throw new Error(
      `${collateralLabel} pool token account ${poolTokenAccountPubkey.toBase58()} ` +
        "was not found on-chain.",
    );
  }
  const poolTokenOwner = readSplTokenOwner(Buffer.from(poolTokenInfo.data));
  if (!poolTokenOwner.equals(poolVaultAuthorityPda)) {
    throw new Error(
      `${collateralLabel} pool token account ${poolTokenAccountPubkey.toBase58()} ` +
        `is owned by ${poolTokenOwner.toBase58()}, expected ` +
        `${poolVaultAuthorityPda.toBase58()}.`,
    );
  }

  // Read vaultCounter → next_id at offset 40 (8+32)
  const vaultCounterInfo = await solanaConnection.getAccountInfo(vaultCounterPda);
  if (!vaultCounterInfo) {
    throw new Error("vaultCounter account not found on-chain");
  }
  const vaultCounterData = Buffer.from(vaultCounterInfo.data);
  const nextId = vaultCounterData.readBigUInt64LE(40);
  const nextIdLe8 = u64Le(nextId);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), settlerConfigPda.toBuffer(), nextIdLe8],
    SOLANA_PROGRAMS.controller,
  );

  const [vaultMmPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_mm"), vaultPda.toBuffer()],
    SOLANA_PROGRAMS.batchSettler,
  );

  // ---------------------------------------------------------------------------
  // ATAs
  // ---------------------------------------------------------------------------

  // Premium mint is always USDC
  const premiumMint = usdcMint;

  const userCollateralAccount = await getAssociatedTokenAddress(
    collateralMint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  // settlerConfig owns ATAs — must allow off-curve
  const settlerOtokenAccount = await getAssociatedTokenAddress(
    oTokenMint, settlerConfigPda, true, TOKEN_PROGRAM_ID,
  );

  const mmPremiumAccount = await getAssociatedTokenAddress(
    premiumMint, makerPubkey, false, TOKEN_PROGRAM_ID,
  );

  const userPremiumAccount = await getAssociatedTokenAddress(
    premiumMint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  const treasuryAccount = await getAssociatedTokenAddress(
    premiumMint, treasuryPubkey, false, TOKEN_PROGRAM_ID,
  );

  // ---------------------------------------------------------------------------
  // Build transaction
  // ---------------------------------------------------------------------------

  const instructions: TransactionInstruction[] = [];

  const [
    settlerOtokenAccountInfo,
    userPremiumAccountInfo,
    userCollateralAccountInfo,
  ] = await solanaConnection.getMultipleAccountsInfo([
    settlerOtokenAccount,
    userPremiumAccount,
    userCollateralAccount,
  ]);

  if (includeSetupInstructions && !settlerOtokenAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        ownerPubkey, settlerOtokenAccount, settlerConfigPda,
        oTokenMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  if (includeSetupInstructions && !userPremiumAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        ownerPubkey, userPremiumAccount, ownerPubkey,
        premiumMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  if (includeSetupInstructions && wrapSolLamports > BigInt(0)) {
    if (isBuy || assetSlug !== "sol") {
      throw new Error("SOL wrapping is only valid for Solana covered calls.");
    }
    if (!userCollateralAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          userCollateralAccount,
          ownerPubkey,
          collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: ownerPubkey,
        toPubkey: userCollateralAccount,
        lamports: wrapSolLamports,
      }),
    );
    instructions.push(createSyncNativeInstruction(userCollateralAccount, TOKEN_PROGRAM_ID));
  }

  if (!isBuy && (wsolBalance ?? BigInt(0)) + wrapSolLamports < collateral) {
    throw new Error(
      "Insufficient wSOL for this trade. Wrap SOL before executing.",
    );
  }

  if (includeApproveInstruction) {
    instructions.push(createApproveInstruction(
      userCollateralAccount,
      settlerConfigPda,
      ownerPubkey,
      collateral,
      [],
      TOKEN_PROGRAM_ID,
    ));
  }

  // ---------------------------------------------------------------------------
  // Ed25519 precompile instruction — verify maker signature
  // ---------------------------------------------------------------------------

  // Build the 72-byte quote message that the maker signed
  const quoteMessage = Buffer.alloc(72);
  oTokenMint.toBuffer().copy(quoteMessage, 0);                              // 32 bytes
  quoteMessage.writeBigUInt64LE(BigInt(quote.bid_price_raw!), 32);          //  8 bytes
  quoteMessage.writeBigInt64LE(BigInt(quote.deadline!), 40);                //  8 bytes (signed)
  quoteMessage.writeBigUInt64LE(BigInt(quote.quote_id!), 48);               //  8 bytes
  quoteMessage.writeBigUInt64LE(BigInt(quote.max_amount_raw!), 56);         //  8 bytes
  quoteMessage.writeBigUInt64LE(BigInt(quote.maker_nonce!), 64);            //  8 bytes

  const signatureBytes: Uint8Array = bs58.decode(quote.signature!);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: makerPubkey.toBytes(),
    message: quoteMessage,
    signature: signatureBytes,
  });
  instructions.push(ed25519Ix);

  // ---------------------------------------------------------------------------
  // executeOrder instruction — 23 accounts, IDL-correct args
  // ---------------------------------------------------------------------------

  const discriminator = Buffer.from("733db418a820d714", "hex");

  // Args: discriminator(8) + amount(8) + bid_price(8) + deadline(8, signed)
  //       + quote_id(8) + max_amount(8) + maker_nonce(8) + collateral_amount(8)
  //       + collateral_mint(32) = 88 bytes total
  const deadlineBuf = Buffer.alloc(8);
  deadlineBuf.writeBigInt64LE(BigInt(quote.deadline!), 0);

  const collateralMintBuf = collateralMint.toBuffer();

  const ixData = Buffer.concat([
    discriminator,
    u64Le(oTokenAmount),
    u64Le(BigInt(quote.bid_price_raw!)),
    deadlineBuf,
    u64Le(BigInt(quote.quote_id!)),
    u64Le(BigInt(quote.max_amount_raw!)),
    u64Le(BigInt(quote.maker_nonce!)),
    u64Le(collateral),
    collateralMintBuf,
  ]);

  const executeIx = new TransactionInstruction({
    programId: SOLANA_PROGRAMS.batchSettler,
    keys: [
      // [0]  settlerConfig
      { pubkey: settlerConfigPda, isSigner: false, isWritable: true },
      // [1]  makerState
      { pubkey: makerStatePda, isSigner: false, isWritable: false },
      // [2]  quoteFill
      { pubkey: quoteFillPda, isSigner: false, isWritable: true },
      // [3]  controllerConfig
      { pubkey: controllerConfigPda, isSigner: false, isWritable: false },
      // [4]  vault
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      // [5]  vaultCounter
      { pubkey: vaultCounterPda, isSigner: false, isWritable: true },
      // [6]  otokenInfo
      { pubkey: otokenInfoPda, isSigner: false, isWritable: false },
      // [7]  otokenMint
      { pubkey: oTokenMint, isSigner: false, isWritable: true },
      // [8]  userCollateralAccount
      { pubkey: userCollateralAccount, isSigner: false, isWritable: true },
      // [9]  poolTokenAccount
      { pubkey: poolTokenAccountPubkey, isSigner: false, isWritable: true },
      // [10] poolVaultAuthority
      { pubkey: poolVaultAuthorityPda, isSigner: false, isWritable: false },
      // [11] settlerOtokenAccount
      { pubkey: settlerOtokenAccount, isSigner: false, isWritable: true },
      // [12] mmPremiumAccount
      { pubkey: mmPremiumAccount, isSigner: false, isWritable: true },
      // [13] userPremiumAccount
      { pubkey: userPremiumAccount, isSigner: false, isWritable: true },
      // [14] treasuryAccount
      { pubkey: treasuryAccount, isSigner: false, isWritable: true },
      // [15] makerOtokenBalance
      { pubkey: makerOtokenBalancePda, isSigner: false, isWritable: true },
      // [16] vaultMm
      { pubkey: vaultMmPda, isSigner: false, isWritable: true },
      // [17] user
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      // [18] maker
      { pubkey: makerPubkey, isSigner: false, isWritable: false },
      // [19] controllerProgram
      { pubkey: SOLANA_PROGRAMS.controller, isSigner: false, isWritable: false },
      // [20] tokenProgram
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // [21] systemProgram
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // [22] instructionsSysvar
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });
  instructions.push(executeIx);

  const altAccount = await loadAlt(solanaConnection);
  const { blockhash } = await solanaConnection.getLatestBlockhash();

  const msgV0 = new TransactionMessage({
    payerKey: ownerPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([altAccount]);

  return new VersionedTransaction(msgV0);
}
