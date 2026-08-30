"""
Real emission-reduction math shared across services. Nothing here is a
placeholder — every function returns a value derived from its inputs.
"""


def reduction_pct(baseline: float, reported: float) -> float:
    if baseline == 0:
        return 0.0
    return round((baseline - reported) / baseline * 100, 2)


def production_change_pct(prod_baseline: float, prod_reported: float) -> float:
    if prod_baseline == 0:
        return 0.0
    return round((prod_reported - prod_baseline) / prod_baseline * 100, 2)


def emission_intensity(emissions: float, production: float) -> float:
    """tCO2e per unit of production/output — a core causality signal."""
    if production == 0:
        return 0.0
    return round(emissions / production, 4)


def summarize(baseline_emissions, reported_emissions, production_baseline, production_reported):
    return {
        "emission_reduction_pct": reduction_pct(baseline_emissions, reported_emissions),
        "production_change_pct": production_change_pct(production_baseline, production_reported),
        "baseline_intensity": emission_intensity(baseline_emissions, production_baseline),
        "reported_intensity": emission_intensity(reported_emissions, production_reported),
        "net_reduction_tco2e": round(baseline_emissions - reported_emissions, 2),
    }
