"""Block explorer URL helpers — XLayer testnet only."""

from src.chains import Chain


def tx_explorer_url(
    tx_hash: str | None,
    chain: str | Chain | None = None,
) -> str | None:
    """Return the XLayer testnet transaction explorer URL."""
    if not tx_hash:
        return None
    return f"https://www.oklink.com/xlayer-test/tx/{tx_hash}"


def address_explorer_url(
    address: str | None,
    chain: str | Chain | None = None,
) -> str | None:
    """Return the XLayer testnet address explorer URL."""
    if not address:
        return None
    return f"https://www.oklink.com/xlayer-test/address/{address}"
