"""Asset registry — XLayer only (OKB)."""

from dataclasses import dataclass
from enum import Enum

from src.chains import Chain
from src.config import settings


class Asset(str, Enum):
    OKB = "okb"


@dataclass(frozen=True)
class AssetConfig:
    symbol: str
    chain: Chain
    decimals: int
    strike_step: float
    short_expiry_strike_step: float
    num_strikes: int
    deribit_index: str = ""
    deribit_currency: str = ""
    min_otm_per_side: int = 4

    @property
    def has_deribit(self) -> bool:
        return bool(self.deribit_index)

    @property
    def chainlink_feed_address(self) -> str:
        if self.symbol == "OKB":
            return settings.chainlink_okb_usd_address
        raise ValueError(f"No Chainlink feed for {self.symbol}")

    @property
    def underlying_address(self) -> str:
        """Token address on the asset's native chain."""
        if self.symbol == "OKB":
            return settings.wokb_address
        raise ValueError(f"No underlying address for {self.symbol}")


ASSET_CONFIGS: dict[Asset, AssetConfig] = {
    Asset.OKB: AssetConfig(
        symbol="OKB",
        chain=Chain.XLAYER,
        decimals=18,
        strike_step=2.0,
        short_expiry_strike_step=1.0,
        num_strikes=5,
    ),
}


def get_asset_config(asset: Asset) -> AssetConfig:
    try:
        return ASSET_CONFIGS[asset]
    except KeyError:
        supported = ", ".join(a.value for a in ASSET_CONFIGS)
        raise ValueError(
            f"Unsupported asset {asset!r}. Supported: {supported}"
        ) from None


def get_chain_for_asset(asset: Asset) -> Chain:
    return get_asset_config(asset).chain


def get_xlayer_assets() -> list[Asset]:
    return [a for a, c in ASSET_CONFIGS.items() if c.chain == Chain.XLAYER]
