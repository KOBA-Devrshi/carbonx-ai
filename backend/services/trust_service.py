from datetime import datetime
from sqlalchemy.orm import Session

from models.models import Credit, Audit, StressTest, RiskScore, AuditLog
from services import risk_engine


def latest_audit(db: Session, credit_id: str):
    return (
        db.query(Audit).filter(Audit.credit_id == credit_id).order_by(Audit.ran_at.desc()).first()
    )


def latest_stress(db: Session, credit_id: str):
    return (
        db.query(StressTest).filter(StressTest.credit_id == credit_id)
        .order_by(StressTest.ran_at.desc()).first()
    )


def recompute_trust_and_persist(db: Session, credit: Credit) -> RiskScore:
    a = latest_audit(db, credit.id)
    s = latest_stress(db, credit.id)
    result = risk_engine.compute_risk_score(credit, latest_audit=a, latest_stress=s)

    row = RiskScore(
        credit_id=credit.id,
        evidence_confidence=result["evidence_confidence"],
        audit_confidence=result["audit_confidence"],
        data_consistency=result["data_consistency"],
        resilience=result["resilience"],
        composite_risk=result["composite_risk"],
        risk_level=result["risk_level"],
    )
    db.add(row)

    credit.trust_score = result["composite_risk"]
    credit.risk_level = result["risk_level"]
    db.add(credit)
    db.commit()
    db.refresh(credit)
    return row


def log_action(db: Session, actor: str, action: str, entity: str, reason: str = "",
                prev_status: str = "", new_status: str = ""):
    entry = AuditLog(
        actor=actor, action=action, entity=entity, reason=reason,
        prev_status=prev_status, new_status=new_status,
    )
    db.add(entry)
    db.commit()
    return entry
