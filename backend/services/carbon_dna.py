"""
Carbon DNA Fingerprint.

A deterministic SHA-256 fingerprint over a canonicalized snapshot of the
credit's identity + evidence + audit + risk state. Re-running this on the
same underlying data always reproduces the same hash; if any upstream
field has changed, the hash changes too — that's what "Verify Carbon DNA"
actually checks.
"""
import hashlib
import json
from datetime import datetime


def canonicalize(credit) -> dict:
    """Build the exact payload that gets hashed. Order-independent (we sort
    keys at serialization time), so field ordering never affects the hash."""
    evidence_refs = sorted(
        [{"type": e.evidence_type, "source": e.source, "hash": e.hash} for e in credit.evidence],
        key=lambda x: (x["type"], x["source"]),
    )
    latest_audit = max(credit.audits, key=lambda a: a.ran_at, default=None)
    latest_stress = max(credit.stress_tests, key=lambda s: s.ran_at, default=None)

    return {
        "project_id": credit.project_id,
        "credit_id": credit.id,
        "project_type": credit.project.project_type,
        "location": credit.project.location,
        "methodology": credit.project.methodology,
        "baseline_emissions": credit.baseline_emissions,
        "reported_emissions": credit.reported_emissions,
        "volume_tco2e": credit.volume_tco2e,
        "issued_at": credit.issued_at.isoformat(),
        "evidence": evidence_refs,
        "evidence_count": len(evidence_refs),
        "audit_recommendation": latest_audit.recommendation if latest_audit else None,
        "audit_confidence": latest_audit.confidence_score if latest_audit else None,
        "stress_resilience": latest_stress.result_resilience if latest_stress else None,
        "risk_level": credit.risk_level.value if hasattr(credit.risk_level, "value") else credit.risk_level,
        "trust_score": credit.trust_score,
    }


def compute_fingerprint(credit) -> tuple[str, dict]:
    payload = canonicalize(credit)
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    fingerprint = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return f"0x{fingerprint}", payload


def verify_fingerprint(credit) -> tuple[bool, str, dict]:
    """Recomputes the fingerprint from current DB state and compares it to
    the stored one. Returns (matches, recomputed_fingerprint, payload)."""
    recomputed, payload = compute_fingerprint(credit)
    matches = (credit.dna_fingerprint == recomputed)
    return matches, recomputed, payload
