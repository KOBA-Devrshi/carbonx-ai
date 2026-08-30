from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, IntegrityReview, IntegrityState, RevalidationStatus
from schemas.schemas import IntegrityActionRequest, IntegrityReviewOut
from services import blockchain
from services.trust_service import recompute_trust_and_persist, log_action

router = APIRouter(prefix="/api/integrity", tags=["integrity"])


@router.get("/{credit_id}", response_model=list[IntegrityReviewOut])
def integrity_history(credit_id: str, db: Session = Depends(get_db)):
    return (
        db.query(IntegrityReview).filter(IntegrityReview.credit_id == credit_id)
        .order_by(IntegrityReview.opened_at.desc()).all()
    )


@router.post("/{credit_id}/flag", response_model=IntegrityReviewOut)
def flag_integrity(credit_id: str, reason: str, triggered_by: str = "AI Auditor", db: Session = Depends(get_db)):
    """Platform-level trading restriction. This does NOT cancel or destroy
    a certified carbon credit — it only restricts marketplace actions on
    CarbonX until an authorized reviewer clears the flag."""
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    review = IntegrityReview(
        credit_id=credit_id, reason=reason, triggered_by=triggered_by, state=IntegrityState.INTEGRITY_REVIEW,
    )
    db.add(review)
    prev = credit.integrity_state
    credit.integrity_state = IntegrityState.INTEGRITY_REVIEW
    credit.integrity_reason = reason
    credit.revalidation_status = RevalidationStatus.INTEGRITY_REVIEW
    db.add(credit)
    db.commit()
    db.refresh(review)

    recompute_trust_and_persist(db, credit)
    chain = blockchain.record_lifecycle_event(credit_id, credit.dna_fingerprint or "", "INTEGRITY_FLAGGED")
    log_action(db, triggered_by, "Integrity Lock Triggered", credit_id, f"{reason} · blockchain: {chain.status}",
               prev.value if hasattr(prev, "value") else str(prev), "INTEGRITY_REVIEW")
    return review


@router.post("/{credit_id}/action", response_model=IntegrityReviewOut)
def resolve_integrity(credit_id: str, payload: IntegrityActionRequest, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    review = (
        db.query(IntegrityReview).filter(IntegrityReview.credit_id == credit_id, IntegrityReview.resolved_at.is_(None))
        .order_by(IntegrityReview.opened_at.desc()).first()
    )
    if not review:
        raise HTTPException(400, "No open integrity review for this credit")

    if payload.action == "clear":
        review.state = IntegrityState.CLEARED
        review.resolved_at = datetime.utcnow()
        review.resolution_notes = payload.resolution_notes or "Cleared after manual review"
        credit.integrity_state = IntegrityState.ACTIVE
        credit.integrity_reason = None
        credit.revalidation_status = RevalidationStatus.REVALIDATED
        new_status = "CLEARED"
    elif payload.action == "escalate":
        review.resolution_notes = payload.resolution_notes or "Escalated to senior review"
        new_status = "ESCALATED"
    else:
        raise HTTPException(400, "action must be 'clear' or 'escalate'")

    db.add(review)
    db.add(credit)
    db.commit()
    db.refresh(review)

    recompute_trust_and_persist(db, credit)
    chain = blockchain.record_lifecycle_event(credit_id, credit.dna_fingerprint or "",
                                               "INTEGRITY_CLEARED" if payload.action == "clear" else "INTEGRITY_FLAGGED")
    log_action(db, payload.actor, f"Integrity Review {new_status.title()}", credit_id,
               f"{payload.resolution_notes or ''} · blockchain: {chain.status}", "INTEGRITY_REVIEW", new_status)
    return review
