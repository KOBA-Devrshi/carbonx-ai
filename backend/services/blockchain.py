"""
Blockchain adapter for recording Carbon DNA / lifecycle events on Polygon.

If POLYGON_RPC_URL, POLYGON_PRIVATE_KEY and CARBON_DNA_CONTRACT_ADDRESS are
all configured, this connects for real via web3.py, builds a real
`recordEvent` transaction against the deployed CarbonDNARegistry contract
(ABI loaded from blockchain/contracts/CarbonDNARegistry.abi.json), signs it
with the configured key, and submits it. If any are missing, or the
network call itself fails, it reports an honest "Demo Mode" / error status
instead of fabricating a transaction hash. This is intentional: never
claim a blockchain write happened when it didn't.
"""
import os
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

RPC_URL = os.getenv("POLYGON_RPC_URL")
PRIVATE_KEY = os.getenv("POLYGON_PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("CARBON_DNA_CONTRACT_ADDRESS")

CONFIGURED = bool(RPC_URL and PRIVATE_KEY and CONTRACT_ADDRESS)

_ABI_PATH = Path(__file__).resolve().parents[2] / "blockchain" / "contracts" / "CarbonDNARegistry.abi.json"

EVENT_TYPE_ENUM = {
    "ISSUED": 0, "DNA_GENERATED": 1, "AUDITED": 2, "STRESS_TESTED": 3,
    "REVALIDATED": 4, "INTEGRITY_FLAGGED": 5, "INTEGRITY_CLEARED": 6,
    "TRANSFERRED": 7, "RETIRED": 8,
}


@dataclass
class ChainResult:
    connected: bool
    network: str = "Polygon"
    contract_address: Optional[str] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    status: str = "Demo Mode"
    reason: Optional[str] = None


def _load_abi():
    if not _ABI_PATH.exists():
        return None
    with open(_ABI_PATH) as f:
        return json.load(f)


def _get_w3(rpc_url: str, timeout: int = 8):
    from web3 import Web3
    return Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": timeout}))


def get_status() -> ChainResult:
    if not CONFIGURED:
        missing = [
            name for name, val in [
                ("POLYGON_RPC_URL", RPC_URL),
                ("POLYGON_PRIVATE_KEY", PRIVATE_KEY),
                ("CARBON_DNA_CONTRACT_ADDRESS", CONTRACT_ADDRESS),
            ] if not val
        ]
        return ChainResult(
            connected=False, contract_address=None, status="Demo Mode",
            reason=f"Not configured: {', '.join(missing)}",
        )
    try:
        w3 = _get_w3(RPC_URL)
        connected = w3.is_connected()
        return ChainResult(
            connected=connected, contract_address=CONTRACT_ADDRESS,
            status="Live Testnet" if connected else "Demo Mode",
            reason=None if connected else "RPC endpoint unreachable",
        )
    except Exception as e:  # pragma: no cover - network dependent
        return ChainResult(connected=False, status="Demo Mode", reason=str(e))


def record_lifecycle_event(credit_id: str, dna_fingerprint: str, event_type: str,
                            w3=None, contract_address: str = None, private_key: str = None) -> ChainResult:
    """Writes {creditId, dnaFingerprint, eventType} to the CarbonDNARegistry
    contract's recordEvent(...) function. Only actually submits a
    transaction when fully configured (or explicit test overrides are
    passed — used by the local eth-tester integration test, never by
    production code paths).

    Real path: build the tx from the loaded ABI, sign with the configured
    private key, send it, and wait for a receipt. Any failure — RPC
    timeout, insufficient testnet funds, contract revert — is caught and
    reported honestly via `reason`, never papered over with a fake hash.
    """
    contract_address = contract_address or CONTRACT_ADDRESS
    private_key = private_key or PRIVATE_KEY
    rpc_url = RPC_URL

    if w3 is None:
        status = get_status()
        if not status.connected:
            return status
        w3 = _get_w3(rpc_url)

    abi = _load_abi()
    if not abi:
        return ChainResult(connected=False, status="Demo Mode",
                            reason="Contract ABI not found — run `npx hardhat compile` in blockchain/ first")

    try:
        acct = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(address=w3.to_checksum_address(contract_address), abi=abi)

        fingerprint_bytes = bytes.fromhex(dna_fingerprint[2:].ljust(64, "0")[:64]) if dna_fingerprint else b"\x00" * 32
        event_code = EVENT_TYPE_ENUM.get(event_type, 0)

        tx = contract.functions.recordEvent(credit_id, fingerprint_bytes, event_code).build_transaction({
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": 300000,
            "gasPrice": w3.eth.gas_price,
            "chainId": w3.eth.chain_id,
        })
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

        return ChainResult(
            connected=True, contract_address=contract_address, tx_hash=tx_hash.hex(),
            block_number=receipt.blockNumber, status="Live Testnet",
            reason=None if receipt.status == 1 else "Transaction reverted on-chain",
        )
    except Exception as e:
        return ChainResult(connected=False, contract_address=contract_address, status="Demo Mode",
                            reason=f"On-chain write failed: {e}")
