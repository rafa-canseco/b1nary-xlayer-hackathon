from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Operator wallet (for bots that send transactions)
    operator_private_key: str = ""

    # Pricing defaults
    risk_free_rate: float = 0.05  # 5% annualized

    # Bot intervals
    otoken_publish_interval_seconds: int = 300  # 5 minutes
    event_poll_interval_seconds: int = 30
    circuit_breaker_poll_seconds: int = 10

    # Circuit breaker
    circuit_breaker_threshold: float = 0.02  # 2% move triggers pause

    # Protocol fee
    protocol_fee_bps: int = 400  # 4% — must match on-chain value
    treasury_address: str = "0x0744e5Abb82A0337B2F6ac65aC83D1e9861C9740"

    # Custom expiry timestamps override (comma-separated Unix timestamps)
    custom_expiry_timestamps: str = ""

    # Hours before expiry to stop showing/creating options
    expiry_cutoff_hours: int = 48
    short_expiry_cutoff_hours: int = 4

    # Expiry settlement
    expiry_settle_hour_utc: int = 8
    settlement_max_retries: int = 5
    settlement_sweep_interval_seconds: int = 300
    settlement_sweep_max_cycles: int = 24

    # ── XLayer testnet ──
    xlayer_rpc_url: str = ""
    xlayer_wss_rpc_url: str = ""
    xlayer_chain_id: int = 1952

    # XLayer oracle (MockChainlinkFeed)
    chainlink_okb_usd_address: str = (
        "0x0A56056Af2e1157B0787E50B4214d21fB9e7fd5a"
    )
    wokb_address: str = "0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8"

    # XLayer contract addresses (defaults from deployments-xlayer.json)
    xlayer_usdc_address: str = (
        "0x4A881f3f745B99f0C5575577D80958a5a16b7347"
    )
    xlayer_batch_settler_address: str = (
        "0x6aea5B95d64962E7F001218159cB5fb11712E8B1"
    )
    xlayer_controller_address: str = (
        "0x75701c1A79Ea45F8BDE9A885A84a7581672d4820"
    )
    xlayer_otoken_factory_address: str = (
        "0x7C9418a13462174b2b29bc0B99807A13B9731690"
    )
    xlayer_margin_pool_address: str = (
        "0x3b14faD41CcbD471296e11Ea348dC303aA3A4156"
    )
    xlayer_oracle_address: str = (
        "0xE3E0bcD6ea5b952F98afcb89D848962100127db1"
    )
    xlayer_whitelist_address: str = (
        "0x16e505DBeE21fD1EFDb8402444e70840af6D6FBa"
    )

    # CoinGecko price updater
    coingecko_price_update_interval_seconds: int = 60
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"

    # CORS allowed origins (comma-separated)
    allowed_origins: str = "*"

    # Beta mode: disables auto-settlement, enables /demo/settle
    beta_mode: bool = False
    demo_api_key: str = ""
    mock_chainlink_feed_address: str = ""

    # Historical P&L / engagement
    weekly_aggregation_day: int = 4
    weekly_aggregation_hour_utc: int = 12
    eth_staking_apy: float = 0.035

    # Email notifications (Resend)
    resend_api_key: str = ""
    email_from: str = "b1nary <notifications@b1nary.app>"
    api_base_url: str = "https://api.b1nary.app"
    unsubscribe_secret: str = ""
    notification_check_interval_seconds: int = 1800

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


def has_xlayer_config() -> bool:
    """True when XLayer RPC + operator + core contracts are configured."""
    return bool(
        settings.xlayer_rpc_url
        and settings.operator_private_key
        and settings.xlayer_otoken_factory_address
    )
