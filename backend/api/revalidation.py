from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, RevalidationEvent
from schemas.schemas import RevalidationResult
from services import revalidation_engine, ai_audit
from services.trust_service import recompute_trust_and_persist, log_action

router = APIRouter(prefix="/api/revalidation", tags=["revalidation"])


@router.get("/{credit_id}/status")
def revalidation_status(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    return {
        "credit_id": credit_id,
        "issued_at": credit.issued_at,
        "last_validated_at": credit.last_validated_at,
        "next_review_at": credit.next_review_at,
        "days_until_review": revalidation_engine.days_until_review(credit),
        "current_confidence": credit.trust_score,
        "status": revalidation_engine.compute_status(credit),
    }


@router.post("/{credit_id}/run", response_model=RevalidationResult)
def run_revalidation(credit_id: str, db: Session = Depends(get_db)):
    """Re-runs the audit + risk pipeline and updates the lifecycle clock —
    this is a real state transition, not a cosmetic status flip."""
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    prev_status = revalidation_engine.compute_status(credit)
    confidence_before = credit.trust_score

    all_credits = db.query(Credit).all()
    audit_result = ai_audit.run_audit(credit, all_credits)

    from models.models import Audit, AuditFinding
    audit = Audit(
        credit_id=credit_id, defender_score=audit_result["defender_score"],
        auditor_challenges=len(audit_result["findings"]), confidence_score=audit_result["confidence_score"],
        risk_level=audit_result["risk_level"], recommendation=audit_result["recommendation"],
        defender_statement=audit_result["defender_statement"], auditor_statement=audit_result["auditor_statement"],
        anomaly_score=audit_result["anomaly_score"],
        narrative_source=audit_result.get("narrative_source", "deterministic"),
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    for f in audit_result["findings"]:
        db.add(AuditFinding(audit_id=audit.id, **f))
    db.commit()

    risk_row = recompute_trust_and_persist(db, credit)

    from datetime import datetime
    credit.last_validated_at = datetime.utcnow()
    credit.next_review_at = revalidation_engine.schedule_next_review(credit.trust_score)
    new_status = revalidation_engine.compute_status(credit)
    credit.revalidation_status = new_status
    db.add(credit)
    db.commit()
    db.refresh(credit)

    event = RevalidationEvent(
        credit_id=credit_id, trigger="manual", previous_status=prev_status, new_status=new_status,
        confidence_before=confidence_before, confidence_after=credit.trust_score,
        notes=f"Re-ran AI audit ({len(audit_result['findings'])} findings) and risk scoring.",
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    log_action(db, "System", "Revalidation Run", credit_id,
               f"{prev_status} -> {new_status}", prev_status, new_status)
    return event


@router.get("/{credit_id}/history", response_model=list[RevalidationResult])
def revalidation_history(credit_id: str, db: Session = Depends(get_db)):
    return (
        db.query(RevalidationEvent).filter(RevalidationEvent.credit_id == credit_id)
        .order_by(RevalidationEvent.ran_at.desc()).all()
    )
