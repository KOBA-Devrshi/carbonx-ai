from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import AuditLog
from services import blockchain
from services import ai_audit

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/blockchain/status")
def blockchain_status():
    return blockchain.get_status().__dict__


@router.get("/ai-status")
def ai_status():
    provider = "openai"
    if ai_audit.OPENAI_BASE_URL:
        if "generativelanguage.googleapis.com" in ai_audit.OPENAI_BASE_URL:
            provider = "gemini (via OpenAI-compatible endpoint)"
        elif "groq.com" in ai_audit.OPENAI_BASE_URL:
            provider = "groq (via OpenAI-compatible endpoint)"
        else:
            provider = f"custom ({ai_audit.OPENAI_BASE_URL})"
    return {
        "narrative_llm_configured": ai_audit.OPENAI_AVAILABLE,
        "provider": provider if ai_audit.OPENAI_AVAILABLE else None,
        "model": ai_audit.OPENAI_MODEL if ai_audit.OPENAI_AVAILABLE else None,
        "note": (
            "When configured, the LLM only rewrites the Defender/Auditor narrative text — "
            "confidence, risk level, recommendation, and findings always come from the "
            "deterministic rule engine + IsolationForest, never the LLM."
        ),
    }


@router.get("/audit-log")
def audit_log(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.ts.desc()).limit(limit).all()
    return [
        {"id": r.id, "ts": r.ts, "actor": r.actor, "action": r.action, "entity": r.entity,
         "reason": r.reason, "prev_status": r.prev_status, "new_status": r.new_status}
        for r in rows
    ]
