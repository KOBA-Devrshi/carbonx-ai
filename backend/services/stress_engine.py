"""
Carbon Credit Stress Test — scenario simulation engine.

Every input is a real parameter (0-100 severity, or a signed % for
production change) that feeds a weighted degradation model against the
credit's current risk/confidence/resilience baseline. Nothing here is
random; the same inputs always produce the same outputs.
"""
from typing import Dict


WEIGHTS = {
    "monitoring_failure_pct": 0.22,
    "evidence_degradation_pct": 0.18,
    "extreme_weather_pct": 0.16,
    "reversal_probability_pct": 0.16,
    "performance_decline_pct": 0.14,
    "emission_increase_pct": 0.14,
}


def base_state(credit) -> Dict[str, float]:
    return {
        "risk": {"LOW": 15, "MEDIUM": 35, "HIGH": 60, "CRITICAL": 82}.get(
            credit.risk_level.value if hasattr(credit.risk_level, "value") else credit.risk_level, 40
        ),
        "confidence": credit.trust_score,
        "resilience": max(5, min(99, credit.trust_score - 5)),
    }


def run_stress_test(credit, inputs: dict) -> dict:
    base = base_state(credit)

    exposure = 0.0
    for key, weight in WEIGHTS.items():
        val = max(0, min(100, inputs.get(key, 0)))
        exposure += (val / 100) * weight * 100

    production_shock = abs(inputs.get("production_change_pct", 0)) * 0.25
    exposure += production_shock

    exposure = round(min(exposure, 75), 2)

    result_risk = round(min(99, base["risk"] + exposure * 0.8), 2)
    result_confidence = round(max(1, base["confidence"] - exposure * 0.9), 2)
    result_resilience = round(max(1, base["resilience"] - exposure), 2)
    value_impact_pct = round(-(exposure * 0.6), 2)  # negative = downward price pressure

    return {
        "base_risk": base["risk"],
        "base_confidence": base["confidence"],
        "base_resilience": base["resilience"],
        "result_risk": result_risk,
        "result_confidence": result_confidence,
        "result_resilience": result_resilience,
        "result_value_impact_pct": value_impact_pct,
        "exposure": exposure,
    }
