"""
Revalidation / expiry-clock engine.

Not a legal expiration — a trust-refresh checkpoint. Determines status
from days-until-review and current confidence, and can be triggered
manually ("Run Revalidation") which re-runs the audit + risk pipeline.
"""
from datetime import datetime, timedelta


def days_until_review(credit) -> float:
    delta = credit.next_review_at - datetime.utcnow()
    return round(delta.total_seconds() / 86400, 2)


def compute_status(credit) -> str:
    if credit.integrity_state and "INTEGRITY_REVIEW" in str(credit.integrity_state):
        return "INTEGRITY_REVIEW"
    days_left = days_until_review(credit)
    if days_left < 0:
        return "REVALIDATION_DUE"
    if credit.trust_score < 50:
        return "UNDER_REVIEW"
    return "TRUSTED"


def schedule_next_review(confidence: float) -> datetime:
    """Higher-confidence credits get a longer runway before the next check."""
    if confidence >= 85:
        days = 180
    elif confidence >= 65:
        days = 120
    elif confidence >= 45:
        days = 60
    else:
        days = 30
    return datetime.utcnow() + timedelta(days=days)
