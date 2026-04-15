# b1nary — Agent-Friendly OKB Options on X Layer

b1nary is a fully collateralized OKB options protocol on X Layer where both humans and AI agents can sell puts and calls, earn premium upfront, and settle on-chain. The protocol exposes an agent-readable `llms.txt` interface so any AI agent can read quotes, approve collateral, and execute trades through standard EVM calls or OKX OnchainOS Agentic Wallet.

## Project Links

| Resource | URL |
|----------|-----|
| Frontend | [xlayer.b1nary.app](https://xlayer.b1nary.app) |
| Backend API | [backend-production-afe9.up.railway.app](https://backend-production-afe9.up.railway.app) |
| Agent Interface | [xlayer.b1nary.app/llms.txt](https://xlayer.b1nary.app/llms.txt) |
| API Docs | [backend-production-afe9.up.railway.app/docs](https://backend-production-afe9.up.railway.app/docs) |
| Agentic Wallet | [`0xd98a0b4a01bb215f289edb4f224dbe392d6f9a53`](https://www.okx.com/web3/explorer/xlayer-test/address/0xd98a0b4a01bb215f289edb4f224dbe392d6f9a53) |
| Chain | X Layer Testnet (chain ID 1952) |
| Explorer | [OKLink X Layer Testnet](https://www.okx.com/web3/explorer/xlayer-test) |

## Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │              X Layer Testnet (1952)          │
                    │                                             │
                    │  BatchSettler ─── Controller ─── MarginPool │
                    │       │              │                      │
                    │  OTokenFactory    Oracle ◄── MockChainlink  │
                    │       │          (CoinGecko → setPrice)     │
                    │  MockUSDC  MockOKB  Whitelist               │
                    └───────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │  Backend   │  │  Market   │  │  Frontend  │
              │  (Railway) │  │  Maker    │  │  (Vercel)  │
              │            │  │ (Railway) │  │            │
              │ - Pricing  │  │           │  │ - OKB earn │
              │ - Faucet   │  │ - EIP-712 │  │ - Wallet   │
              │ - Indexer  │  │   quotes  │  │ - Execute  │
              │ - Bots     │  │ - Hedging │  │            │
              │ - llms.txt │  │           │  │            │
              └─────┬──────┘  └───────────┘  └────────────┘
                    │
              ┌─────▼──────┐
              │  Supabase   │
              │  (Postgres) │
              └─────────────┘
```

**Components:**

- **contracts/** — Solidity options protocol (Opyn-based), mock tokens, oracle, deployment scripts
- **backend/** — FastAPI pricing API with CoinGecko-fed OKB price, XLayer bots (oToken manager, event indexer, expiry settler, circuit breaker, price updater), faucet
- **frontend/** — Next.js trading interface for OKB options on X Layer with Privy wallet connection
- **market-maker/** — Automated EIP-712 quote signer for OKB PUT/CALL markets with Hyperliquid hedging

## Deployment Addresses (X Layer Testnet)

| Contract | Address |
|----------|---------|
| MockOKB | `0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8` |
| MockUSDC | `0x4A881f3f745B99f0C5575577D80958a5a16b7347` |
| MockChainlinkFeedOKB | `0x0A56056Af2e1157B0787E50B4214d21fB9e7fd5a` |
| AddressBook | `0x8Bb949cE0ee8129A64841a88B1a5de62de3E2F5e` |
| Controller | `0x75701c1A79Ea45F8BDE9A885A84a7581672d4820` |
| MarginPool | `0x3b14faD41CcbD471296e11Ea348dC303aA3A4156` |
| OTokenFactory | `0x7C9418a13462174b2b29bc0B99807A13B9731690` |
| Oracle | `0xE3E0bcD6ea5b952F98afcb89D848962100127db1` |
| Whitelist | `0x16e505DBeE21fD1EFDb8402444e70840af6D6FBa` |
| BatchSettler | `0x6aea5B95d64962E7F001218159cB5fb11712E8B1` |

## OnchainOS / Agentic Wallet Usage

### Modules Used

- **OnchainOS Wallet** — Agentic Wallet for on-chain identity (`onchainos wallet login`, `addresses`, `balance`, `send`)
- **OnchainOS Gateway** — Gas estimation and transaction broadcasting via OnchainOS API
- **OnchainOS Market** — On-chain data queries for token information

### Agentic Wallet as Project Identity

The project's Agentic Wallet address is `0xd98a0b4a01bb215f289edb4f224dbe392d6f9a53`. It was used to:
- Claim testnet tokens via the faucet
- Demonstrate the agent trading flow
- Serve as the project's on-chain identity

### Important: Testnet Limitation

OnchainOS Agentic Wallet `--chain xlayer` maps to X Layer **mainnet** (chain ID 196). X Layer testnet (1952) is not supported for `contract-call`. The `llms.txt` documents this clearly and provides an EOA-based alternative for testnet interaction. See the [llms.txt Wallet Integration section](https://xlayer.b1nary.app/llms.txt) for details.

## How It Works

### For Humans (Frontend)

1. Connect wallet to X Layer testnet via the frontend
2. Claim test tokens (MockUSDC + MockOKB + gas) from the faucet
3. Browse live OKB option quotes (puts and calls at multiple strikes/expiries)
4. Select a quote, approve collateral, and execute the trade on-chain
5. Track positions and settlement in the Positions page

### For AI Agents (llms.txt)

1. Read `llms.txt` at the deployed URL — it contains all contract addresses, API endpoints, and calldata encoding instructions
2. Fund a wallet via `POST /faucet/xlayer`
3. Fetch executable quotes from `GET /prices?asset=okb`
4. Approve collateral to BatchSettler
5. Encode and send `executeOrder()` calldata to BatchSettler
6. Verify position via `GET /positions/{address}`

The protocol is fully collateralized: no margin calls, no liquidations. Sellers deposit collateral upfront and receive premium immediately.

### Market Maker

The automated market maker runs as a background service:
- Fetches real OKB price from CoinGecko every 60s and writes it to the MockChainlinkFeed on-chain
- Creates oTokens for multiple strikes around the current spot price (3 expiry dates)
- Signs EIP-712 quotes and submits them to the backend every 15 seconds
- Provides ~30 executable quotes across 13 strike prices at any time

## X Layer Ecosystem Positioning

b1nary demonstrates that X Layer can support sophisticated DeFi primitives beyond simple swaps:

- **Options protocol** — structured products that don't exist on X Layer today
- **Agent-native design** — `llms.txt` as a first-class protocol interface for AI agents
- **Real pricing** — CoinGecko-fed OKB oracle with synthetic IV derived from Deribit ETH options market
- **Full stack** — contracts, backend, market maker, and frontend all deployed and operational

## Team

- **Rafa Canseco** — Solo builder. Full-stack development, smart contracts, infrastructure.

## Local Development

```bash
# Backend
cd backend && cp .env.xlayer.example .env
# Fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPERATOR_PRIVATE_KEY
uv run uvicorn src.main:app --reload

# Frontend
cd frontend && cp .env.xlayer.example .env.local
# Fill NEXT_PUBLIC_PRIVY_APP_ID
bun install && bun dev

# Market Maker
cd market-maker && cp .env.xlayer.example .env
# Fill MM_PRIVATE_KEY, MM_API_KEY
uv run python -m src.main
```

Never commit private keys, API keys, or service role keys.

## License

MIT
