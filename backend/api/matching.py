from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Credit, BuyerProfile, MatchResult
from schemas.schemas import BuyerProfileIn, MatchOut
from services import matching_engine
from services.trust_service import log_action

router = APIRouter(prefix="/api/matching", tags=["matching"])


@router.post("/run", response_model=list[MatchOut])
def run_matching(payload: BuyerProfileIn, db: Session = Depends(get_db)):
    buyer = BuyerProfile(**payload.model_dump())
    db.add(buyer)
    db.commit()
    db.refresh(buyer)

    all_credits = db.query(Credit).all()
    scored = matching_engine.run_matching(buyer, all_credits)

    out = []
    for row in scored[:8]:
        c = row["credit"]
        mr = MatchResult(buyer_id=buyer.id, credit_id=c.id, match_score=row["match_score"], reasons=row["reasons"])
        db.add(mr)
        out.append(MatchOut(credit_id=c.id, project_name=c.project.name,
                             match_score=row["match_score"], reasons=row["reasons"]))
    db.commit()

    log_action(db, "User", "Buyer Matching Run", buyer.company, f"{len(out)} matches generated")
    return out
