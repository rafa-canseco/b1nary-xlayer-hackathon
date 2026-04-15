"""
EIP-712 signing and verification for MM quotes — XLayer only.

Matches the BatchSettler contract's domain and Quote struct:
  Domain: { name: "b1nary", version: "1", chainId, verifyingContract }
  Quote:  { oToken, bidPrice, deadline, quoteId, maxAmount, makerNonce }
"""
from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3

from src.config import settings


QUOTE_TYPES = {
    "Quote": [
        {"name": "oToken", "type": "address"},
        {"name": "bidPrice", "type": "uint256"},
        {"name": "deadline", "type": "uint256"},
        {"name": "quoteId", "type": "uint256"},
        {"name": "maxAmount", "type": "uint256"},
        {"name": "makerNonce", "type": "uint256"},
    ],
}


def _build_quote_message(
    otoken: str,
    bid_price: int,
    deadline: int,
    quote_id: int,
    max_amount: int,
    maker_nonce: int,
) -> dict:
    return {
        "oToken": Web3.to_checksum_address(otoken),
        "bidPrice": bid_price,
        "deadline": deadline,
        "quoteId": quote_id,
        "maxAmount": max_amount,
        "makerNonce": maker_nonce,
    }


def get_xlayer_domain() -> dict:
    """Return EIP-712 domain for XLayer BatchSettler."""
    if not settings.xlayer_batch_settler_address:
        raise RuntimeError(
            "xlayer_batch_settler_address is not configured."
        )
    return {
        "name": "b1nary",
        "version": "1",
        "chainId": settings.xlayer_chain_id,
        "verifyingContract": Web3.to_checksum_address(
            settings.xlayer_batch_settler_address
        ),
    }


def get_domain_for_chain(chain: str) -> dict:
    """Return the EIP-712 domain (always XLayer)."""
    return get_xlayer_domain()


def sign_quote(
    private_key: str,
    otoken: str,
    bid_price: int,
    deadline: int,
    quote_id: int,
    max_amount: int,
    maker_nonce: int,
    domain: dict | None = None,
) -> str:
    """Sign a quote with EIP-712 and return the hex signature."""
    if domain is None:
        domain = get_xlayer_domain()
    message = _build_quote_message(
        otoken, bid_price, deadline, quote_id, max_amount, maker_nonce
    )
    signable = encode_typed_data(
        domain_data=domain,
        message_types=QUOTE_TYPES,
        message_data=message,
    )
    signed = Account.sign_message(signable, private_key=private_key)
    return "0x" + signed.signature.hex()


def recover_quote_signer(
    otoken: str,
    bid_price: int,
    deadline: int,
    quote_id: int,
    max_amount: int,
    maker_nonce: int,
    signature: str,
    domain: dict | None = None,
) -> str:
    """Recover the signer address from an EIP-712 quote signature."""
    if domain is None:
        domain = get_xlayer_domain()
    message = _build_quote_message(
        otoken, bid_price, deadline, quote_id, max_amount, maker_nonce
    )
    signable = encode_typed_data(
        domain_data=domain,
        message_types=QUOTE_TYPES,
        message_data=message,
    )
    return Account.recover_message(
        signable,
        signature=bytes.fromhex(signature.removeprefix("0x")),
    )
