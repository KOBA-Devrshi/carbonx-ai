from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, PricingResult
from schemas.schemas import PricingOut
from services import pricing_engine, risk_engine
from services.trust_service import latest_audit, latest_stress, log_action

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.get("/{credit_id}", response_model=PricingOut)
def get_pricing(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    a = latest_audit(db, credit_id)
    s = latest_stress(db, credit_id)
    ec = risk_engine.evidence_confidence(credit)
    dc = risk_engine.data_consistency(credit)

    result = pricing_engine.compute_fair_value(credit, latest_audit=a, latest_stress=s,
                                                evidence_confidence=ec, data_consistency=dc)

    row = PricingResult(
        credit_id=credit_id, market_price=result["market_price"],
        fair_value_low=result["fair_value_low"], fair_value_high=result["fair_value_high"],
        risk_adjustment_pct=result["risk_adjustment_pct"], explanation=result["explanation"],
    )
    db.add(row)
    db.commit()

    log_action(db, "System", "Pricing Computed", credit_id,
               f"Fair value {result['fair_value_low']}-{result['fair_value_high']}")
    return PricingOut(credit_id=credit_id, **result)
