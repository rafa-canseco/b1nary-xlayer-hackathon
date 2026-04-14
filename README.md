# b1nary XLayer Hackathon

b1nary brings structured volatility products to XLayer. This hackathon build deploys an OKB options market on XLayer testnet with executable quotes, mock liquidity, and a frontend trading flow.

## Demo

- Chain: XLayer Testnet
- Chain ID: `1952`
- RPC: `https://testrpc.xlayer.tech/terigon`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`
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
2. Claim test tokens through the XLayer faucet flow.
3. Open the OKB market and view executable PUT/CALL quotes.
4. Accept a quote.
5. Confirm the on-chain transaction on the XLayer explorer.

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
