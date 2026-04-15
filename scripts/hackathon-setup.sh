#!/usr/bin/env bash
set -euo pipefail

# OKX Build X Hackathon — one-shot setup script
# Run: bash scripts/hackathon-setup.sh <ONCHAINOS_API_KEY>
#
# What it does:
# 1. Logs into OnchainOS with your API key
# 2. Gets your Agentic Wallet XLayer address
# 3. Funds it via the b1nary faucet
# 4. Approves MockUSDC + MockOKB to MarginPool
# 5. Prints a summary ready for the submission

BACKEND_URL="https://backend-production-afe9.up.railway.app"
MARGIN_POOL="0x3b14faD41CcbD471296e11Ea348dC303aA3A4156"
MOCK_USDC="0x4A881f3f745B99f0C5575577D80958a5a16b7347"
MOCK_OKB="0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8"
# Max uint256 approval
MAX_APPROVE="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
# approve(address,uint256) selector = 0x095ea7b3
APPROVE_CALLDATA_USDC="0x095ea7b3000000000000000000000000${MARGIN_POOL:2}${MAX_APPROVE}"
APPROVE_CALLDATA_OKB="0x095ea7b3000000000000000000000000${MARGIN_POOL:2}${MAX_APPROVE}"

if [ -z "${1:-}" ]; then
  echo "Usage: bash scripts/hackathon-setup.sh <ONCHAINOS_API_KEY>"
  echo ""
  echo "Get your API key at: https://web3.okx.com/onchainos/dev-portal"
  exit 1
fi

API_KEY="$1"

echo "=== Step 1: Login to OnchainOS ==="
onchainos login --api-key "$API_KEY"
echo ""

echo "=== Step 2: Get Agentic Wallet address ==="
WALLET_OUTPUT=$(onchainos wallet addresses --chain xlayer 2>&1)
echo "$WALLET_OUTPUT"
# Extract the 0x address
WALLET_ADDR=$(echo "$WALLET_OUTPUT" | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
if [ -z "$WALLET_ADDR" ]; then
  echo "ERROR: Could not extract wallet address. Check onchainos wallet setup."
  echo "Visit: https://web3.okx.com/onchainos/dev-docs/wallet/install-your-agentic-wallet"
  exit 1
fi
echo "Wallet: $WALLET_ADDR"
echo ""

echo "=== Step 3: Fund via faucet ==="
FAUCET_RESP=$(curl -s -X POST "$BACKEND_URL/faucet/xlayer" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$WALLET_ADDR\"}")
echo "$FAUCET_RESP"
echo ""

echo "=== Step 4: Wait for funding txs to confirm ==="
sleep 10
echo ""

echo "=== Step 5: Check balance ==="
onchainos wallet balance --chain xlayer
echo ""

echo "=== Step 6: Approve MockUSDC to MarginPool ==="
onchainos wallet contract-call \
  --chain xlayer \
  --to "$MOCK_USDC" \
  --input-data "$APPROVE_CALLDATA_USDC"
echo ""

echo "=== Step 7: Approve MockOKB to MarginPool ==="
onchainos wallet contract-call \
  --chain xlayer \
  --to "$MOCK_OKB" \
  --input-data "$APPROVE_CALLDATA_OKB"
echo ""

echo "=== Done! ==="
echo ""
echo "Agentic Wallet: $WALLET_ADDR"
echo "Backend API:    $BACKEND_URL"
echo "Frontend:       https://xlayer.b1nary.app (or localhost:3000)"
echo ""
echo "Next steps:"
echo "  1. Claim Moltbook account (human): see claim URL in ~/.config/moltbook/credentials.json"
echo "  2. Submit to m/buildx: bash scripts/submit-hackathon.sh"
echo "  3. Vote on 5+ projects: bash scripts/vote-hackathon.sh"
