from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, OwnershipEvent, IntegrityState
from schemas.schemas import CreditListItem, PurchaseRequest, RetireRequest
from services import blockchain
from services.trust_service import log_action

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


@router.get("/listings", response_model=list[CreditListItem])
def listings(db: Session = Depends(get_db)):
    credits = db.query(Credit).filter(
        Credit.available_tco2e > 0, Credit.integrity_state != IntegrityState.INTEGRITY_REVIEW
    ).all()
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


@router.post("/{credit_id}/purchase")
def purchase(credit_id: str, payload: PurchaseRequest, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")
    if credit.integrity_state == IntegrityState.INTEGRITY_REVIEW:
        raise HTTPException(423, "Credit is under Integrity Review — trading restricted on CarbonX")
    if payload.quantity > credit.available_tco2e:
        raise HTTPException(400, "Requested quantity exceeds available volume")

    fee = round(credit.market_price * payload.quantity * 0.015, 2)
    total = round(credit.market_price * payload.quantity + fee, 2)

    credit.available_tco2e -= payload.quantity
    credit.owner = payload.buyer
    db.add(credit)

    chain = blockchain.record_lifecycle_event(credit_id, credit.dna_fingerprint or "", "TRANSFERRED")
    ev = OwnershipEvent(
        credit_id=credit_id, event_type="TRANSFERRED", from_owner="CarbonX Registry Pool",
        to_owner=payload.buyer, quantity=payload.quantity, tx_ref=chain.tx_hash,
    )
    db.add(ev)
    db.commit()

    log_action(db, payload.buyer, "Credit Purchased (Demo Transaction)", credit_id,
               f"{payload.quantity} tCO2e for {total}")
    return {
        "status": "DEMO TRANSACTION",
        "credit_id": credit_id,
        "quantity": payload.quantity,
        "price_per_tonne": credit.market_price,
        "fee": fee,
        "total": total,
        "blockchain": chain.__dict__,
    }


@router.post("/{credit_id}/retire")
def retire(credit_id: str, payload: RetireRequest, db: Session = Depends(get_db)):
    credit = db.query(Credit).filter(Credit.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit not found")

    chain = blockchain.record_lifecycle_event(credit_id, credit.dna_fingerprint or "", "RETIRED")
    ev = OwnershipEvent(
        credit_id=credit_id, event_type="RETIRED", from_owner=credit.owner, to_owner=payload.beneficiary,
        quantity=payload.quantity, tx_ref=chain.tx_hash,
    )
    db.add(ev)
    db.commit()

    log_action(db, credit.owner, "Credit Retired", credit_id,
               f"{payload.quantity} tCO2e retired for {payload.beneficiary}: {payload.reason}")
    return {
        "status": "RETIRED (DEMO)",
        "certificate_id": ev.id,
        "credit_id": credit_id,
        "quantity": payload.quantity,
        "beneficiary": payload.beneficiary,
        "retired_at": datetime.utcnow(),
        "blockchain": chain.__dict__,
    }


@router.get("/{credit_id}/lifecycle")
def lifecycle(credit_id: str, db: Session = Depends(get_db)):
    events = (
        db.query(OwnershipEvent).filter(OwnershipEvent.credit_id == credit_id).order_by(OwnershipEvent.ts).all()
    )
    return [{"event_type": e.event_type, "from_owner": e.from_owner, "to_owner": e.to_owner,
              "quantity": e.quantity, "tx_ref": e.tx_ref, "ts": e.ts} for e in events]
