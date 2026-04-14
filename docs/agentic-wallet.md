# Agentic Wallet Demo

This hackathon build is designed to be operated by OKX OnchainOS Agentic Wallet.

The web app is the human interface. `llms.txt` is the agent interface. The same deployed protocol can be used by both.

## Setup

Check login and XLayer address:

```bash
onchainos wallet status
onchainos wallet addresses --chain xlayer
```

If not logged in, authenticate with OnchainOS first. Never place OnchainOS API keys, wallet secrets, or seed phrases in the repository.

## Demo Flow

Set the backend URL:

```bash
export API=http://localhost:8000
```

Use the deployed Railway backend URL once available.

Fund the Agentic Wallet:

```bash
curl -X POST "$API/faucet/xlayer" \
  -H "Content-Type: application/json" \
  -d '{"address":"0xAgenticWallet"}'
```

Fetch executable OKB quotes:

```bash
curl "$API/prices?asset=okb"
```

Approve collateral by encoding `approve(address,uint256)` and sending it through Agentic Wallet:

```bash
onchainos wallet contract-call \
  --chain xlayer \
  --to 0x4A881f3f745B99f0C5575577D80958a5a16b7347 \
  --input-data <approve_mockusdc_to_marginpool_calldata>
```

Execute an order by encoding `BatchSettler.executeOrder(...)` from the selected quote:

```bash
onchainos wallet contract-call \
  --chain xlayer \
  --to 0x6aea5B95d64962E7F001218159cB5fb11712E8B1 \
  --input-data <executeOrder_calldata>
```

The reference TypeScript encoder is in `frontend/src/lib/execution.ts`.

## Proof For Submission

Capture these values for Moltbook:

- Agentic Wallet address.
- Faucet tx hashes.
- Collateral approval tx hash.
- `executeOrder` tx hash.
- XLayer explorer links.

## Safety

- Use XLayer testnet only.
- Do not use `--force` on the first Agentic Wallet transaction attempt.
- Use small notional size.
- Skip incomplete, expired, or stale quotes.
- Never expose private keys or API keys.
