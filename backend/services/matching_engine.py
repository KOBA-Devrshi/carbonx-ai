"""
Buyer-Specific Credit Matching.

A real weighted-criteria scoring algorithm — not a random number. Every
sub-score is computed from an actual comparison between the buyer profile
and the credit's data, and the reasons list is generated from which
sub-scores actually cleared their threshold.
"""

WEIGHTS = {
    "budget_fit": 0.25,
    "risk_fit": 0.25,
    "geography_fit": 0.15,
    "project_type_fit": 0.15,
    "confidence_fit": 0.15,
    "volume_fit": 0.10,
}

RISK_TOLERANCE_MAP = {
    "Conservative": {"LOW": 100, "MEDIUM": 55, "HIGH": 15, "CRITICAL": 0},
    "Balanced":     {"LOW": 90,  "MEDIUM": 75, "HIGH": 40, "CRITICAL": 10},
    "Aggressive":   {"LOW": 80,  "MEDIUM": 85, "HIGH": 70, "CRITICAL": 35},
}


def score_credit(buyer, credit) -> tuple[float, list[str]]:
    reasons = []

    # Budget fit
    price = credit.market_price
    budget_fit = max(0, 100 - abs(price - buyer.budget_per_tonne) / max(buyer.budget_per_tonne, 1) * 100)
    if price <= buyer.budget_per_tonne:
        reasons.append("Within budget")

    # Risk fit
    risk_level = credit.risk_level.value if hasattr(credit.risk_level, "value") else credit.risk_level
    risk_fit = RISK_TOLERANCE_MAP.get(buyer.risk_tolerance, RISK_TOLERANCE_MAP["Balanced"]).get(risk_level, 40)
    if risk_fit >= 70:
        reasons.append(f"Risk profile ({risk_level}) matches your {buyer.risk_tolerance.lower()} tolerance")

    # Geography fit
    if buyer.geography_preference == "Any" or buyer.geography_preference.lower() in credit.project.location.lower():
        geo_fit = 100
        if buyer.geography_preference != "Any":
            reasons.append("Geographic preference matched")
    else:
        geo_fit = 35

    # Project type fit
    if buyer.project_type_preference == "Any" or buyer.project_type_preference == credit.project.project_type:
        type_fit = 100
        if buyer.project_type_preference != "Any":
            reasons.append("Preferred project type")
    else:
        type_fit = 45

    # Confidence fit
    confidence_fit = 100 if credit.trust_score >= buyer.confidence_requirement else max(
        0, 100 - (buyer.confidence_requirement - credit.trust_score) * 3
    )
    if credit.trust_score >= buyer.confidence_requirement:
        reasons.append(f"Evidence confidence ({credit.trust_score}%) meets your requirement")

    # Volume fit
    volume_fit = 100 if credit.available_tco2e >= buyer.required_tco2e else max(
        0, credit.available_tco2e / max(buyer.required_tco2e, 1) * 100
    )
    if credit.available_tco2e >= buyer.required_tco2e:
        reasons.append("Required volume available")

    score = (
        budget_fit * WEIGHTS["budget_fit"]
        + risk_fit * WEIGHTS["risk_fit"]
        + geo_fit * WEIGHTS["geography_fit"]
        + type_fit * WEIGHTS["project_type_fit"]
        + confidence_fit * WEIGHTS["confidence_fit"]
        + volume_fit * WEIGHTS["volume_fit"]
    )

    if credit.integrity_state and "INTEGRITY_REVIEW" in str(credit.integrity_state):
        score *= 0.2
        reasons = ["⚠ Under Integrity Review — not recommended until cleared"]

    return round(score, 1), reasons


def run_matching(buyer, credits: list) -> list[dict]:
    scored = []
    for c in credits:
        if c.available_tco2e <= 0:
            continue
        s, reasons = score_credit(buyer, c)
        scored.append({"credit": c, "match_score": s, "reasons": reasons})
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored
