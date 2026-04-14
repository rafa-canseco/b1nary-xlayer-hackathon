# b1nary XLayer Hackathon

b1nary brings structured volatility products to XLayer. This hackathon build deploys an OKB options market on XLayer testnet with executable quotes, mock liquidity, a frontend trading flow, and an agent-readable interface for OKX OnchainOS Agentic Wallet.

The core idea: b1nary is not only a dapp. It is an agent-friendly options protocol. An agent can read [`llms.txt`](llms.txt), understand the deployed XLayer contracts, fetch executable OKB quotes, approve collateral, and call `BatchSettler.executeOrder(...)` through Agentic Wallet.

## Demo

- Chain: XLayer Testnet
- Chain ID: `1952`
- RPC: `https://testrpc.xlayer.tech/terigon`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`
- Agent interface: [`llms.txt`](llms.txt)
- Demo video: add link after recording

## Repository Layout

```text
contracts/       Solidity options protocol, mocks, deployment scripts, ABIs
backend/         Pricing API, OKB synthetic IV, faucet, XLayer bots, event indexer
frontend/        Next.js app configured for XLayer testnet and OKB options
market-maker/    Automated EIP-712 quote signer for OKB PUT/CALL markets
deployments/     Public XLayer testnet deployment addresses
docs/            Architecture and demo notes
```

## Agent Interface

The repository exposes a root [`llms.txt`](llms.txt) for agents and serves the same content from `frontend/public/llms.txt` when the frontend is deployed.

Agent flow:

1. Read `llms.txt`.
2. Get an XLayer address from OKX OnchainOS Agentic Wallet.
3. Fund the Agentic Wallet through `POST /faucet/xlayer`.
4. Fetch executable OKB quotes from `GET /prices?asset=okb`.
5. Approve MockUSDC or MockOKB to MarginPool.
6. Execute a selected quote through BatchSettler.
7. Save the XLayer tx hashes as proof of work.

See [`docs/agentic-wallet.md`](docs/agentic-wallet.md) for the demo flow.

## XLayer Testnet Contracts

| Contract | Address |
| --- | --- |
| MockOKB | `0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8` |
| MockUSDC | `0x4A881f3f745B99f0C5575577D80958a5a16b7347` |
| MockChainlinkFeedOKB | `0x0A56056Af2e1157B0787E50B4214d21fB9e7fd5a` |
| MockAavePool | `0x85991D3A3Ab8B77DE856c3128077319fA64b9d29` |
| MockSwapRouter | `0x700c01dEe9bb9a41899b53D08856DAD5147eF8E7` |
| AddressBook | `0x8Bb949cE0ee8129A64841a88B1a5de62de3E2F5e` |
| Controller | `0x75701c1A79Ea45F8BDE9A885A84a7581672d4820` |
| MarginPool | `0x3b14faD41CcbD471296e11Ea348dC303aA3A4156` |
| OTokenFactory | `0x7C9418a13462174b2b29bc0B99807A13B9731690` |
| Oracle | `0xE3E0bcD6ea5b952F98afcb89D848962100127db1` |
| Whitelist | `0x16e505DBeE21fD1EFDb8402444e70840af6D6FBa` |
| BatchSettler | `0x6aea5B95d64962E7F001218159cB5fb11712E8B1` |

## Demo Flow

1. Connect a wallet to XLayer testnet.
2. Open `llms.txt` and show the agent-readable protocol interface.
3. Show the Agentic Wallet XLayer address.
4. Claim test tokens through the XLayer faucet flow.
5. Open the OKB market and view executable PUT/CALL quotes.
6. Approve collateral and accept a quote.
7. Confirm the on-chain transaction on the XLayer explorer.

## Local Demo

The hackathon demo can run locally while still executing transactions on XLayer testnet. The repository is public for judges to inspect, and the video demonstrates the live testnet flow.

Recommended runtime:

```bash
# backend
cd backend
uv run uvicorn src.main:app --reload

# frontend
cd frontend
cp .env.xlayer.example .env.local
bun install
bun dev

# market maker
cd market-maker
cp .env.xlayer.example .env
# fill MM_PRIVATE_KEY and MM_API_KEY locally only
uv run python -m src.main
```

Never commit real private keys, API keys, service role keys, or `.env` files.

## Deployment

Use separate disposable services for the hackathon:

- Frontend: Vercel, ideally `https://xlayer.b1nary.app`
- Backend: Railway
- Market maker: Railway
- Database: separate Supabase project

`xlayer.b1nary.app` can point to a Vercel project from this separate public repo. The DNS provider for `b1nary.app` only needs the record Vercel requests, typically a CNAME for `xlayer`.

See [`docs/deployment.md`](docs/deployment.md).
