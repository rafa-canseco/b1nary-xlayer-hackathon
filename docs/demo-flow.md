# Demo Flow

## Setup

1. Start backend with XLayer config.
2. Start market maker with a funded and whitelisted MM wallet.
3. Log in to OKX OnchainOS Agentic Wallet and get the XLayer address.
4. Start frontend with `.env.xlayer.example` copied to `.env.local`.
5. Open the frontend locally or at `https://xlayer.b1nary.app`.

## Recording Script

1. Show the deployed XLayer contracts and public repo.
2. Open `llms.txt` and explain that it is the agent-readable protocol interface.
3. Show the Agentic Wallet XLayer address.
4. Fund the Agentic Wallet through `/faucet/xlayer`.
5. Fetch `/prices?asset=okb` and show executable PUT/CALL quotes.
6. Approve collateral through Agentic Wallet or the frontend flow.
7. Execute one quote through `BatchSettler.executeOrder(...)`.
8. Open the transaction on the XLayer testnet explorer.
9. Show the same OKB market in the human frontend.

## Submission Notes

Pitch:

> b1nary brings structured volatility products to XLayer. This demo shows an agent-friendly OKB options protocol: humans use the dapp, while agents read `llms.txt`, use OKX OnchainOS Agentic Wallet, and interact directly with the deployed XLayer contracts.
