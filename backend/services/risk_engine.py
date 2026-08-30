"""
Composite Risk / Trust Score engine.

Trust score = weighted blend of evidence confidence, audit confidence,
data consistency and stress resilience, minus penalties for open audit
findings and integrity flags. Every component is visible — never a single
opaque number.
"""

WEIGHTS = {
    "evidence_confidence": 0.28,
    "audit_confidence": 0.30,
    "data_consistency": 0.22,
    "resilience": 0.20,
}


def evidence_confidence(credit) -> float:
    if not credit.evidence:
        return 30.0
    return round(sum(e.quality_score for e in credit.evidence) / len(credit.evidence), 2)


def data_consistency(credit) -> float:
    """Penalizes large mismatches between production and emission changes."""
    if credit.production_baseline == 0:
        return 60.0
    prod_change = abs((credit.production_reported - credit.production_baseline) / credit.production_baseline * 100)
    if credit.baseline_emissions == 0:
        em_change = 0
    else:
        em_change = abs((credit.baseline_emissions - credit.reported_emissions) / credit.baseline_emissions * 100)
    gap = abs(em_change - prod_change)
    return round(max(10, 100 - gap * 1.4), 2)


def compute_risk_score(credit, latest_audit=None, latest_stress=None) -> dict:
    ec = evidence_confidence(credit)
    dc = data_consistency(credit)
    ac = latest_audit.confidence_score if latest_audit else 55.0
    res = latest_stress.result_resilience if latest_stress else max(10, ac - 5)

    composite = (
        ec * WEIGHTS["evidence_confidence"]
        + ac * WEIGHTS["audit_confidence"]
        + dc * WEIGHTS["data_consistency"]
        + res * WEIGHTS["resilience"]
    )

    if credit.integrity_state and str(credit.integrity_state).endswith("INTEGRITY_REVIEW"):
        composite -= 25

    composite = round(max(1, min(99, composite)), 2)

    if composite >= 80:
        level = "LOW"
    elif composite >= 60:
        level = "MEDIUM"
    elif composite >= 35:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return {
        "evidence_confidence": ec,
        "audit_confidence": ac,
        "data_consistency": dc,
        "resilience": res,
        "composite_risk": composite,
        "risk_level": level,
    }
