# Architecture

## Contracts

The protocol is deployed on XLayer testnet with mock infrastructure for the hackathon:

- MockOKB and MockUSDC provide test collateral.
- MockChainlinkFeedOKB provides the OKB/USD oracle price.
- MockAavePool and MockSwapRouter stand in for testnet liquidity infrastructure.
- BatchSettler executes signed option orders.
- Whitelist enables OKB PUT and CALL products.

## Backend

The backend adds XLayer as an EVM chain and OKB as a supported asset. OKB has no Deribit options market, so implied volatility is derived synthetically from ETH IV and realized volatility ratio, with a fixed fallback.

The backend also provides:

- `/prices?asset=okb`
- `/spot?asset=okb`
- `POST /faucet/xlayer`
- XLayer event indexing
- XLayer settlement and circuit-breaker bots
- OKB price updater for the mock Chainlink feed

## Market Maker

The market maker runs as an automated quote agent. It signs EIP-712 quotes for OKB PUT and CALL options using the XLayer chain domain and submits them to the backend.

For live execution, the MM wallet must:

- hold OKB testnet gas;
- hold MockOKB and MockUSDC;
- be whitelisted as maker in BatchSettler;
- approve MockOKB and MockUSDC to MarginPool.

## Frontend

The frontend is configured as an XLayer-only hackathon build. Users connect an EVM wallet, claim test tokens, view OKB quotes, and accept trades through the same BatchSettler execution flow.
