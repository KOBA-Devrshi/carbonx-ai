from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, Audit, AuditFinding
from schemas.schemas import AuditResult
from services import ai_audit
from services.trust_service import recompute_trust_and_persist, log_action

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.post("/{credit_id}/run", response_model=AuditResult)
def run_audit(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    all_credits = db.query(Credit).all()
    result = ai_audit.run_audit(credit, all_credits)

    audit = Audit(
        credit_id=credit_id,
        defender_score=result["defender_score"],
        auditor_challenges=len(result["findings"]),
        confidence_score=result["confidence_score"],
        risk_level=result["risk_level"],
        recommendation=result["recommendation"],
        defender_statement=result["defender_statement"],
        auditor_statement=result["auditor_statement"],
        anomaly_score=result["anomaly_score"],
        narrative_source=result.get("narrative_source", "deterministic"),
        debate_turns=result.get("debate_turns", []),
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    for f in result["findings"]:
        db.add(AuditFinding(audit_id=audit.id, **f))
    db.commit()

    recompute_trust_and_persist(db, credit)
    log_action(db, "AI Auditor", "AI Audit Run", credit_id,
               f"{len(result['findings'])} finding(s), recommendation {result['recommendation']}")
    db.refresh(audit)
    return audit


@router.get("/{credit_id}/latest", response_model=AuditResult)
def latest_audit(credit_id: str, db: Session = Depends(get_db)):
    audit = (
        db.query(Audit).filter(Audit.credit_id == credit_id).order_by(Audit.ran_at.desc()).first()
    )
    if not audit:
        raise HTTPException(404, "No audit has been run for this credit yet")
    return audit


@router.get("/{credit_id}/history", response_model=list[AuditResult])
def audit_history(credit_id: str, db: Session = Depends(get_db)):
    return (
        db.query(Audit).filter(Audit.credit_id == credit_id).order_by(Audit.ran_at.desc()).all()
    )
