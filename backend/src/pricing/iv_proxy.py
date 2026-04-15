"""IV proxy for assets without Deribit options — XLayer only.

Estimates implied volatility from 30-day realized volatility
with a vol-risk-premium multiplier. Falls back to a hardcoded
IV (0.80) if the calculation fails.
"""

import logging
import math

import httpx

from src.config import settings
from src.pricing.assets import Asset

logger = logging.getLogger(__name__)

FALLBACK_IV = 0.80  # 80% annualized
VOL_RISK_PREMIUM = 1.3  # IV typically trades above RV

_COINGECKO_IDS: dict[str, str] = {
    "OKB": "okb",
}

_client = httpx.AsyncClient(timeout=15.0)


async def _fetch_30d_prices(coingecko_id: str) -> list[float]:
    """Fetch 30-day daily closing prices from CoinGecko."""
    url = (
        f"{settings.coingecko_api_url}/coins/{coingecko_id}/market_chart"
    )
    resp = await _client.get(
        url, params={"vs_currency": "usd", "days": "30"}
    )
    resp.raise_for_status()
    prices = resp.json()["prices"]
    return [p[1] for p in prices]


def _realized_vol(prices: list[float]) -> float:
    """Annualized realized volatility from a price series."""
    if len(prices) < 2:
        raise ValueError("Need at least 2 prices for realized vol")
    log_returns = [
        math.log(prices[i] / prices[i - 1])
        for i in range(1, len(prices))
    ]
    mean = sum(log_returns) / len(log_returns)
    variance = sum((r - mean) ** 2 for r in log_returns) / (
        len(log_returns) - 1
    )
    daily_vol = math.sqrt(variance)
    return daily_vol * math.sqrt(365)


async def get_proxy_iv(asset: Asset) -> float:
    """Estimate IV from realized volatility with a risk premium.

    Returns annualized IV as a decimal (e.g. 0.80 for 80%).
    Falls back to FALLBACK_IV on any error.
    """
    from src.pricing.assets import get_asset_config

    cfg = get_asset_config(asset)

    cg_id = _COINGECKO_IDS.get(cfg.symbol)
    if cg_id is None:
        logger.warning(
            "No CoinGecko ID for %s, using fallback IV %.2f",
            cfg.symbol,
            FALLBACK_IV,
        )
        return FALLBACK_IV

    try:
        asset_prices = await _fetch_30d_prices(cg_id)
        rv_asset = _realized_vol(asset_prices)
        proxy_iv = rv_asset * VOL_RISK_PREMIUM
        logger.info(
            "Proxy IV for %s: %.4f (RV=%.4f, premium=%.1fx)",
            cfg.symbol,
            proxy_iv,
            rv_asset,
            VOL_RISK_PREMIUM,
        )
        return proxy_iv

    except Exception:
        logger.warning(
            "IV proxy failed for %s, using fallback %.2f",
            cfg.symbol,
            FALLBACK_IV,
            exc_info=True,
        )
        return FALLBACK_IV
