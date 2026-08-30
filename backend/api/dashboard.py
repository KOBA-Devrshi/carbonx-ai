from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit
from schemas.schemas import DashboardSummary
from services import revalidation_engine

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)):
    credits = db.query(Credit).all()
    total = len(credits) or 1

    def val(x):
        return x.value if hasattr(x, "value") else x

    verified = sum(1 for c in credits if val(c.verification_status) == "CARBONX_VERIFIED")
    under_review = sum(1 for c in credits if val(c.verification_status) == "UNDER_REVIEW"
                        or val(c.integrity_state) == "INTEGRITY_REVIEW")
    revalidation_due = sum(1 for c in credits if revalidation_engine.compute_status(c) in
                            ("REVALIDATION_DUE", "UNDER_REVIEW", "INTEGRITY_REVIEW"))

    by_status: dict = {}
    by_risk: dict = {}
    for c in credits:
        s = val(c.verification_status)
        r = val(c.risk_level)
        by_status[s] = by_status.get(s, 0) + 1
        by_risk[r] = by_risk.get(r, 0) + 1

    return DashboardSummary(
        total_credits=len(credits),
        verified_credits=verified,
        under_review_credits=under_review,
        average_confidence=round(sum(c.trust_score for c in credits) / total, 2),
        average_risk=round(100 - sum(c.trust_score for c in credits) / total, 2),
        total_tco2e_tracked=round(sum(c.volume_tco2e for c in credits), 2),
        total_market_value=round(sum(c.volume_tco2e * c.market_price for c in credits), 2),
        revalidation_due=revalidation_due,
        by_status=by_status,
        by_risk=by_risk,
    )
