import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database.session import Base, engine
from api import credits, audit, stress_test, revalidation, integrity, matching, pricing, marketplace, ingestion, dashboard, system

Base.metadata.create_all(bind=engine)

APP_MODE = os.getenv("APP_MODE", "DEMO")

app = FastAPI(
    title="CarbonX AI API",
    description="The Trust & Intelligence Layer for Carbon Markets — prototype backend.",
    version="0.1.0",
)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(credits.router)
app.include_router(audit.router)
app.include_router(stress_test.router)
app.include_router(revalidation.router)
app.include_router(integrity.router)
app.include_router(matching.router)
app.include_router(pricing.router)
app.include_router(marketplace.router)
app.include_router(ingestion.router)
app.include_router(dashboard.router)
app.include_router(system.router)


@app.get("/")
def root():
    return {
        "service": "CarbonX AI API",
        "mode": APP_MODE,
        "docs": "/docs",
        "tagline": "Don't just trade a carbon credit. Challenge it.",
    }


@app.get("/health")
def health():
    """Lightweight liveness check for uptime monitors (UptimeRobot,
    cron-job.org, etc.) to ping every few minutes — this is what keeps a
    free-tier Render service from spinning down due to inactivity. Kept
    deliberately cheap: no DB query, no external calls, just confirms the
    process is up and responding."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/health/detailed")
def health_detailed():
    """A heavier check for your own debugging — confirms the database is
    actually reachable and reports current AI/blockchain configuration
    status, without needing separate calls to /api/system/*. Don't point
    an external uptime pinger at this one; use the lightweight /health for
    that and save this for when you're diagnosing something yourself."""
    from database.session import SessionLocal
    from services import blockchain, ai_audit

    db_ok = True
    db_error = None
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
    except Exception as e:
        db_ok = False
        db_error = str(e)

    chain = blockchain.get_status()

    return {
        "status": "ok" if db_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "database": {"connected": db_ok, "error": db_error},
        "blockchain": {"status": chain.status, "connected": chain.connected},
        "ai_narrative": {"configured": ai_audit.OPENAI_AVAILABLE},
        "mode": APP_MODE,
    }