#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$CONTRACTS_DIR/.env.xlayer-mainnet}"

echo "=== Options Protocol — X Layer Mainnet Deploy ==="

load_env_file() {
    local file="$1"
    if [ ! -f "$file" ]; then
        return
    fi

    echo "[..] Loading $file..."
    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*#.*$ || -z "$line" ]] && continue

        if [[ "$line" =~ ^set[[:space:]]+-x[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)[[:space:]]+(.+)$ ]]; then
            key="${BASH_REMATCH[1]}"
            val="${BASH_REMATCH[2]}"
            val="${val%\"}"
            val="${val#\"}"
            export "$key=$val"
            continue
        fi

        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            val="${BASH_REMATCH[2]}"
            val="${val%\"}"
            val="${val#\"}"
            export "$key=$val"
        fi
    done < "$file"
}

load_env_file "$ENV_FILE"

for var in XLAYER_MAINNET_RPC_URL OPERATOR_ADDRESS; do
    if [ -z "${!var:-}" ]; then
        echo "[FAIL] Missing env var: $var"
        echo "Set it in $ENV_FILE or export it before running."
        exit 1
    fi
done

SIGNER_ARGS=()
if [ -n "${PRIVATE_KEY:-}" ]; then
    SIGNER_ARGS=(--private-key "$PRIVATE_KEY")
elif [ -n "${FOUNDRY_ACCOUNT:-}" ]; then
    SIGNER_ARGS=(--account "$FOUNDRY_ACCOUNT")
    if [ -n "${DEPLOYER_ADDRESS:-}" ]; then
        SIGNER_ARGS+=(--sender "$DEPLOYER_ADDRESS")
    fi
elif [ "${USE_LEDGER:-false}" = "true" ]; then
    if [ -z "${DEPLOYER_ADDRESS:-}" ]; then
        echo "[FAIL] DEPLOYER_ADDRESS is required when USE_LEDGER=true"
        exit 1
    fi
    SIGNER_ARGS=(--ledger --sender "$DEPLOYER_ADDRESS")
    if [ -n "${LEDGER_HD_PATH:-}" ]; then
        SIGNER_ARGS+=(--hd-paths "$LEDGER_HD_PATH")
    fi
else
    echo "[FAIL] Configure one signer: PRIVATE_KEY, FOUNDRY_ACCOUNT, or USE_LEDGER=true"
    exit 1
fi

echo "[ok] Env vars loaded"

echo "[..] Building contracts..."
cd "$CONTRACTS_DIR"
forge build --force --silent 2>/dev/null || forge build --force

echo "[..] Deploying to X Layer mainnet..."
DEPLOY_OUTPUT=$(forge script script/DeployXLayerMainnet.s.sol:DeployXLayerMainnet \
    --rpc-url "$XLAYER_MAINNET_RPC_URL" \
    "${SIGNER_ARGS[@]}" \
    --broadcast \
    --slow \
    -vvvv 2>&1) || {
    echo "$DEPLOY_OUTPUT"
    echo "[FAIL] Deployment failed"
    exit 1
}

echo "$DEPLOY_OUTPUT" | grep -E "^(DEPLOYED|IMPLEMENTATION|CONFIG):" || true

OUTPUT_FILE=$(mktemp)
printf "%s\n" "$DEPLOY_OUTPUT" > "$OUTPUT_FILE"

echo "[..] Writing deployments-xlayer-mainnet.json..."
python3 - "$OUTPUT_FILE" "$CONTRACTS_DIR/deployments-xlayer-mainnet.json" <<'PY'
import datetime as dt
import json
import os
import re
import sys

output_path, deployment_path = sys.argv[1], sys.argv[2]
text = open(output_path).read()

proxies = {}
implementations = {}
for prefix, name, addr in re.findall(r"(DEPLOYED|IMPLEMENTATION):([A-Za-z0-9]+):(0x[a-fA-F0-9]{40})", text):
    if prefix == "DEPLOYED":
        proxies[name] = addr
    else:
        implementations[name] = addr

required = [
    "AddressBook",
    "Controller",
    "MarginPool",
    "OTokenFactory",
    "Oracle",
    "Whitelist",
    "BatchSettler",
]
missing = [name for name in required if not proxies.get(name) or not implementations.get(name)]
if missing:
    raise SystemExit(f"Missing deployed addresses in forge output: {', '.join(missing)}")

def env(name, default=""):
    return os.getenv(name, default)

deployment = {
    "network": "X Layer Mainnet",
    "chainId": 196,
    "deployedAt": dt.date.today().isoformat(),
    "deployer": env("DEPLOYER_ADDRESS", "unknown"),
    "proxies": proxies,
    "implementations": implementations,
    "config": {
        "operator": env("OPERATOR_ADDRESS"),
        "mm": env("MM_ADDRESS", env("OPERATOR_ADDRESS")),
        "treasury": env("TREASURY_ADDRESS"),
        "protocolFeeBps": int(env("PROTOCOL_FEE_BPS", "400")),
        "escapeDelay": int(env("ESCAPE_DELAY", "259200")),
        "swapFeeTier": int(env("SWAP_FEE_TIER", "500")),
        "assetSwapFeeTiers": {
            "xETH": int(env("SWAP_FEE_TIER", "500")),
        },
        "priceDeviationThresholdBps": int(env("PRICE_DEVIATION_THRESHOLD_BPS", "1000")),
        "maxOracleStaleness": int(env("MAX_ORACLE_STALENESS", "3600")),
        "marginPoolAaveConfigured": env("CONFIGURE_MARGIN_POOL_AAVE", "false").lower() == "true",
        "marginPoolAaveEnabled": env("ENABLE_MARGIN_POOL_AAVE", "false").lower() == "true",
    },
    "externalAddresses": {
        "xETH": env("XETH_ADDRESS", "0xe7b000003a45145decf8a28fc755ad5ec5ea025a"),
        "USDT0": env("USDT0_ADDRESS", "0x779ded0c9e1022225f8e0630b35a9b54be713736"),
        "ChainlinkETHUSD": env("CHAINLINK_ETH_USD_FEED", "0x8b85b50535551f8e8cdaf78da235b5cf1005907b"),
        "AaveV3Pool": env("AAVE_POOL_ADDRESS", "0xe3f3caefdd7180f884c01e57f65df979af84f116"),
        "UniswapSwapRouter": env("UNISWAP_SWAP_ROUTER", "0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca"),
        "UniswapV3Factory": env("UNISWAP_V3_FACTORY", "0x4b2ab38dbf28d31d467aa8993f6c2585981d6804"),
        "xETHUSDT0Pool": env("XETH_USDT0_POOL", "0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc"),
        "aXETH": env("A_XETH_ADDRESS", "0xe6639ba6c1d79be6d4c776e4c17504538d1719cd"),
        "aUSDT0": env("A_USDT0_ADDRESS", "0xf356ae412db5df43bd3a10746f7ad4e1c4de4297"),
    },
    "tokenDecimals": {
        "xETH": 18,
        "USDT0": 6,
        "oToken": 8,
    },
}

with open(deployment_path, "w") as f:
    json.dump(deployment, f, indent=2)
    f.write("\n")

print(f"[ok] Wrote {deployment_path}")
PY

if [ "${VERIFY_CONTRACTS:-false}" = "true" ]; then
    echo "[..] Verifying implementations on X Layer explorer..."
    BLOCKSCOUT_URL="${XLAYER_VERIFIER_URL:-https://www.okx.com/web3/explorer/xlayer/api/}"

    get_impl() {
        python3 - "$CONTRACTS_DIR/deployments-xlayer-mainnet.json" "$1" <<'PY'
import json
import sys
data = json.load(open(sys.argv[1]))
print(data["implementations"][sys.argv[2]])
PY
    }

    verify_contract() {
        local name="$1"
        local path="$2"
        local addr
        addr="$(get_impl "$name")"
        echo "  Verifying $path at $addr..."
        forge verify-contract \
            --rpc-url "$XLAYER_MAINNET_RPC_URL" \
            --verifier blockscout \
            --verifier-url "$BLOCKSCOUT_URL" \
            "$addr" \
            "$path" 2>&1 | tail -1 || true
    }

    verify_contract "AddressBook" "src/core/AddressBook.sol:AddressBook"
    verify_contract "Controller" "src/core/Controller.sol:Controller"
    verify_contract "MarginPool" "src/core/MarginPool.sol:MarginPool"
    verify_contract "OTokenFactory" "src/core/OTokenFactory.sol:OTokenFactory"
    verify_contract "Oracle" "src/core/Oracle.sol:Oracle"
    verify_contract "Whitelist" "src/core/Whitelist.sol:Whitelist"
    verify_contract "BatchSettler" "src/core/BatchSettler.sol:BatchSettler"
fi

echo "[..] Exporting ABIs..."
ABI_DIR="$CONTRACTS_DIR/abis"
mkdir -p "$ABI_DIR"

for contract in AddressBook Controller MarginPool OTokenFactory Oracle Whitelist BatchSettler OToken; do
    ABI_FILE="$CONTRACTS_DIR/out/${contract}.sol/${contract}.json"
    if [ -f "$ABI_FILE" ]; then
        python3 - "$ABI_FILE" "$ABI_DIR/${contract}.json" <<'PY'
import json
import sys
data = json.load(open(sys.argv[1]))
with open(sys.argv[2], "w") as f:
    json.dump(data["abi"], f, indent=2)
    f.write("\n")
PY
    else
        echo "  [!] ABI not found for $contract"
    fi
done

rm -f "$OUTPUT_FILE"

echo ""
echo "=== X Layer Mainnet Deployment Summary ==="
echo "  Chain:                         X Layer Mainnet (196)"
echo "  Deployments:                   $CONTRACTS_DIR/deployments-xlayer-mainnet.json"
echo "  ABIs:                          $ABI_DIR/"
echo "  Pair:                          xETH / USDt0"
echo "  Token decimals:                xETH=18 USDt0=6 oToken=8"
echo "  Swap fee tier:                 ${SWAP_FEE_TIER:-500}"
echo "  MarginPool Aave enabled:       ${ENABLE_MARGIN_POOL_AAVE:-false}"
echo ""
echo "Next: update backend, frontend, and market-maker env vars from deployments-xlayer-mainnet.json."
