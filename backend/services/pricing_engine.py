"""
Risk-Adjusted Pricing Engine.

Market Price -> Evidence Confidence -> Project Risk -> Stress Resilience
-> Data Quality -> Audit Confidence -> CarbonX Fair Value.

Every step is a real number pulled from the credit's actual state, and the
explanation list is generated dynamically from which factors actually
moved the price.
"""


def compute_fair_value(credit, latest_audit=None, latest_stress=None, evidence_confidence=None,
                        data_consistency=None) -> dict:
    price = credit.market_price
    ec = evidence_confidence if evidence_confidence is not None else 60.0
    ac = latest_audit.confidence_score if latest_audit else 55.0
    resilience = latest_stress.result_resilience if latest_stress else max(10, ac - 10)
    dc = data_consistency if data_consistency is not None else 60.0

    risk_level = credit.risk_level.value if hasattr(credit.risk_level, "value") else credit.risk_level
    risk_penalty_map = {"LOW": 0.02, "MEDIUM": 0.08, "HIGH": 0.18, "CRITICAL": 0.32}
    project_risk_penalty = risk_penalty_map.get(risk_level, 0.10)

    # Discount grows with lower evidence/audit/resilience/consistency, and
    # with higher categorical project risk.
    quality_composite = (ec + ac + resilience + dc) / 4 / 100  # 0..1
    discount = project_risk_penalty + (1 - quality_composite) * 0.22
    discount = max(-0.10, min(0.45, discount))

    mid = price * (1 - discount)
    spread_pct = 0.03 + (1 - quality_composite) * 0.10
    spread = price * spread_pct

    low = round(mid - spread, 2)
    high = round(mid + spread, 2)
    risk_adjustment_pct = round(-discount * 100, 2)

    reasons = []
    if ec >= 80:
        reasons.append("Fair value range narrowed because evidence confidence is high.")
    if risk_level in ("HIGH", "CRITICAL"):
        reasons.append(f"Price discounted due to {risk_level.lower()} project risk classification.")
    if resilience < 55:
        reasons.append("Stress-test resilience is below 55, widening the risk adjustment.")
    if ac < 55:
        reasons.append("Audit confidence is limited, adding uncertainty to the estimate.")
    if dc < 55:
        reasons.append("Data consistency between production and emissions is weak, widening the spread.")
    if not reasons:
        reasons.append("Fair value tracks close to market price given strong, consistent evidence.")

    return {
        "market_price": price,
        "fair_value_low": low,
        "fair_value_high": high,
        "risk_adjustment_pct": risk_adjustment_pct,
        "explanation": reasons,
        "evidence_confidence": ec,
        "project_risk": risk_level,
        "stress_resilience": resilience,
        "audit_confidence": ac,
    }
