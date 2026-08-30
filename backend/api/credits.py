from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, Project, Evidence, VerificationStatus
from schemas.schemas import CreditOut, CreditListItem, CreditCreate, EvidenceIn, EvidenceOut, DNAResponse, TimelineEvent
from services import carbon_dna, blockchain
from services.trust_service import recompute_trust_and_persist, log_action

router = APIRouter(prefix="/api/credits", tags=["credits"])


@router.get("", response_model=List[CreditListItem])
def list_credits(
    project_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    max_price: Optional[float] = None,
    min_confidence: Optional[float] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Credit).join(Project)
    if project_type:
        q = q.filter(Project.project_type == project_type)
    if risk_level:
        q = q.filter(Credit.risk_level == risk_level)
    if max_price is not None:
        q = q.filter(Credit.market_price <= max_price)
    if min_confidence is not None:
        q = q.filter(Credit.trust_score >= min_confidence)
    credits = q.all()
    return [
        CreditListItem(
            id=c.id, project_name=c.project.name, project_type=c.project.project_type,
            location=c.project.location, volume_tco2e=c.volume_tco2e, available_tco2e=c.available_tco2e,
            market_price=c.market_price, trust_score=c.trust_score,
            risk_level=c.risk_level.value if hasattr(c.risk_level, "value") else c.risk_level,
            verification_status=c.verification_status.value if hasattr(c.verification_status, "value") else c.verification_status,
            revalidation_status=c.revalidation_status.value if hasattr(c.revalidation_status, "value") else c.revalidation_status,
            integrity_state=c.integrity_state.value if hasattr(c.integrity_state, "value") else c.integrity_state,
        ) for c in credits
    ]


@router.get("/{credit_id}", response_model=CreditOut)
def get_credit(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    return credit


@router.post("/{credit_id}/evidence", response_model=EvidenceOut)
def add_evidence(credit_id: str, payload: EvidenceIn, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    import hashlib, time
    ev = Evidence(
        credit_id=credit_id, evidence_type=payload.evidence_type, source=payload.source,
        quality_score=payload.quality_score,
        hash="0x" + hashlib.sha256(f"{credit_id}{payload.evidence_type}{time.time()}".encode()).hexdigest()[:16],
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    recompute_trust_and_persist(db, credit)
    log_action(db, "User", "Evidence Submitted", credit_id, f"{payload.evidence_type} from {payload.source}")
    return ev


@router.get("/{credit_id}/timeline", response_model=List[TimelineEvent])
def credit_timeline(credit_id: str, db: Session = Depends(get_db)):
    """Aggregates the credit's real lifecycle across every table it touches —
    evidence, audits, stress tests, revalidation, integrity reviews, and
    ownership/blockchain events — into one chronological trust timeline.
    Nothing here is synthesized; every row is a real DB record."""
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    from models.models import Audit, StressTest, RevalidationEvent, IntegrityReview, OwnershipEvent

    events: List[TimelineEvent] = [
        TimelineEvent(ts=credit.issued_at, stage="ISSUANCE", title="Credit Issued",
                       detail=f"{credit.volume_tco2e} tCO2e issued to {credit.owner}", status="ISSUED")
    ]
    for e in credit.evidence:
        events.append(TimelineEvent(ts=e.uploaded_at, stage="EVIDENCE", title=f"Evidence: {e.evidence_type}",
                                     detail=f"Source: {e.source} · quality {e.quality_score}", status=None))
    if credit.dna_verified_at:
        events.append(TimelineEvent(ts=credit.dna_verified_at, stage="DNA", title="Carbon DNA Generated",
                                     detail=(credit.dna_fingerprint or "")[:24] + "…", status="GENERATED"))
    for a in db.query(Audit).filter(Audit.credit_id == credit_id).order_by(Audit.ran_at):
        events.append(TimelineEvent(ts=a.ran_at, stage="AUDIT", title=f"AI vs AI Audit — {a.recommendation}",
                                     detail=f"Confidence {a.confidence_score}% · {a.auditor_challenges} finding(s)",
                                     status=a.recommendation))
    for s in db.query(StressTest).filter(StressTest.credit_id == credit_id).order_by(StressTest.ran_at):
        events.append(TimelineEvent(ts=s.ran_at, stage="STRESS", title=f"Stress Test — {s.scenario_name}",
                                     detail=f"Resilience {s.result_resilience} (from {s.base_resilience})", status=None))
    for r in db.query(RevalidationEvent).filter(RevalidationEvent.credit_id == credit_id).order_by(RevalidationEvent.ran_at):
        events.append(TimelineEvent(ts=r.ran_at, stage="REVALIDATION", title="Revalidation Run",
                                     detail=f"{r.previous_status} → {r.new_status} · confidence {r.confidence_before} → {r.confidence_after}",
                                     status=r.new_status))
    for i in db.query(IntegrityReview).filter(IntegrityReview.credit_id == credit_id).order_by(IntegrityReview.opened_at):
        events.append(TimelineEvent(ts=i.opened_at, stage="INTEGRITY", title=f"Integrity Review — {i.state.value if hasattr(i.state,'value') else i.state}",
                                     detail=i.reason, status=i.state.value if hasattr(i.state, "value") else str(i.state)))
        if i.resolved_at:
            events.append(TimelineEvent(ts=i.resolved_at, stage="INTEGRITY", title="Integrity Review Resolved",
                                         detail=i.resolution_notes or "", status="RESOLVED"))
    for o in db.query(OwnershipEvent).filter(OwnershipEvent.credit_id == credit_id).order_by(OwnershipEvent.ts):
        events.append(TimelineEvent(
            ts=o.ts, stage="OWNERSHIP" if o.event_type != "RETIRED" else "OWNERSHIP",
            title=f"{o.event_type.title()}: {o.quantity} tCO2e",
            detail=f"{o.from_owner or '—'} → {o.to_owner or '—'}" + (f" · tx {o.tx_ref}" if o.tx_ref else " · blockchain: Demo Mode"),
            status=o.event_type,
        ))

    events.sort(key=lambda e: e.ts)
    return events



@router.post("/{credit_id}/dna/generate", response_model=DNAResponse)
def generate_dna(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    fingerprint, payload = carbon_dna.compute_fingerprint(credit)
    credit.dna_fingerprint = fingerprint
    credit.dna_verified_at = datetime.utcnow()
    db.add(credit)
    db.commit()

    chain = blockchain.record_lifecycle_event(credit_id, fingerprint, "DNA_GENERATED")
    log_action(db, "System", "Carbon DNA Generated", credit_id,
               f"Fingerprint computed from canonical state · blockchain: {chain.status}")
    return DNAResponse(credit_id=credit_id, fingerprint=fingerprint, canonical_payload=payload,
                        verified=True, computed_at=datetime.utcnow(), blockchain=chain.__dict__)


@router.post("/{credit_id}/dna/verify", response_model=DNAResponse)
def verify_dna(credit_id: str, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    if not credit.dna_fingerprint:
        raise HTTPException(400, "No DNA fingerprint has been generated yet for this credit")
    matches, recomputed, payload = carbon_dna.verify_fingerprint(credit)
    chain = blockchain.get_status()
    log_action(db, "User", "Carbon DNA Verify Requested", credit_id,
               "Match" if matches else "MISMATCH — underlying data changed since last fingerprint")
    return DNAResponse(credit_id=credit_id, fingerprint=recomputed, canonical_payload=payload,
                        verified=matches, computed_at=datetime.utcnow(), blockchain=chain.__dict__)
