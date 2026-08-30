from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, StressTest
from schemas.schemas import StressTestRequest, StressTestResult
from services import stress_engine
from services.trust_service import log_action

router = APIRouter(prefix="/api/stress-test", tags=["stress-test"])


@router.post("/{credit_id}/run", response_model=StressTestResult)
def run_stress_test(credit_id: str, payload: StressTestRequest, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    inputs = payload.model_dump(exclude={"scenario_name"})
    result = stress_engine.run_stress_test(credit, inputs)

    row = StressTest(
        credit_id=credit_id,
        scenario_name=payload.scenario_name or "Custom Scenario",
        inputs=inputs,
        base_risk=result["base_risk"],
        base_confidence=result["base_confidence"],
        base_resilience=result["base_resilience"],
        result_risk=result["result_risk"],
        result_confidence=result["result_confidence"],
        result_resilience=result["result_resilience"],
        result_value_impact_pct=result["result_value_impact_pct"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    log_action(db, "System", "Stress Test Run", credit_id,
               f"{payload.scenario_name}: exposure {result['exposure']}%, "
               f"confidence {result['base_confidence']} -> {result['result_confidence']}")
    return row


@router.get("/{credit_id}/history", response_model=list[StressTestResult])
def stress_test_history(credit_id: str, db: Session = Depends(get_db)):
    return (
        db.query(StressTest).filter(StressTest.credit_id == credit_id)
        .order_by(StressTest.ran_at.desc()).all()
    )
