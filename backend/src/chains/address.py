"""Address format detection and validation — XLayer (EVM) only."""

import re

from src.chains import Chain

ETH_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def detect_chain(address: str) -> Chain:
    """Detect chain from address format.

    Only 0x-prefixed 40-hex-char EVM addresses are valid (XLayer).
    Raises ValueError if the address doesn't match.
    """
    if ETH_ADDRESS_RE.match(address):
        return Chain.XLAYER

    raise ValueError(
        f"Unrecognized address format: {address!r}. "
        "Expected 0x-prefixed hex (XLayer)."
    )
