import enum
import uuid
from datetime import datetime, timedelta

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum, JSON
)
from sqlalchemy.orm import relationship

from database.session import Base


def gen_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    CARBONX_VERIFIED = "CARBONX_VERIFIED"
    UNDER_REVIEW = "UNDER_REVIEW"
    REJECTED = "REJECTED"


class RevalidationStatus(str, enum.Enum):
    TRUSTED = "TRUSTED"
    REVALIDATION_DUE = "REVALIDATION_DUE"
    UNDER_REVIEW = "UNDER_REVIEW"
    REVALIDATED = "REVALIDATED"
    INTEGRITY_REVIEW = "INTEGRITY_REVIEW"


class IntegrityState(str, enum.Enum):
    ACTIVE = "ACTIVE"
    FLAGGED = "FLAGGED"
    INTEGRITY_REVIEW = "INTEGRITY_REVIEW"
    CLEARED = "CLEARED"


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: gen_id("USR"))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, default="buyer")  # buyer | admin | verifier | developer
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=lambda: gen_id("PROJ"))
    name = Column(String, nullable=False)
    project_type = Column(String, nullable=False)  # Solar, Wind, Forestry, Biogas, Efficiency...
    developer = Column(String, nullable=False)
    location = Column(String, nullable=False)
    methodology = Column(String, nullable=False)
    demo_data = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    credits = relationship("Credit", back_populates="project", cascade="all, delete-orphan")


class Credit(Base):
    __tablename__ = "credits"
    id = Column(String, primary_key=True, default=lambda: gen_id("CX"))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    reporting_period = Column(String, nullable=False)
    baseline_emissions = Column(Float, nullable=False)   # tCO2e
    reported_emissions = Column(Float, nullable=False)   # tCO2e
    production_baseline = Column(Float, nullable=False)
    production_reported = Column(Float, nullable=False)
    volume_tco2e = Column(Float, nullable=False)          # credit volume issued
    available_tco2e = Column(Float, nullable=False)
    market_price = Column(Float, nullable=False)          # USD per tCO2e
    owner = Column(String, default="CarbonX Registry Pool")

    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    revalidation_status = Column(Enum(RevalidationStatus), default=RevalidationStatus.TRUSTED)
    integrity_state = Column(Enum(IntegrityState), default=IntegrityState.ACTIVE)
    integrity_reason = Column(Text, nullable=True)

    trust_score = Column(Float, default=0)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.MEDIUM)

    dna_fingerprint = Column(String, nullable=True)
    dna_verified_at = Column(DateTime, nullable=True)

    issued_at = Column(DateTime, default=datetime.utcnow)
    last_validated_at = Column(DateTime, default=datetime.utcnow)
    next_review_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=180))

    project = relationship("Project", back_populates="credits")
    evidence = relationship("Evidence", back_populates="credit", cascade="all, delete-orphan")
    audits = relationship("Audit", back_populates="credit", cascade="all, delete-orphan")
    stress_tests = relationship("StressTest", back_populates="credit", cascade="all, delete-orphan")
    risk_scores = relationship("RiskScore", back_populates="credit", cascade="all, delete-orphan")
    revalidation_events = relationship("RevalidationEvent", back_populates="credit", cascade="all, delete-orphan")
    integrity_reviews = relationship("IntegrityReview", back_populates="credit", cascade="all, delete-orphan")
    ownership_events = relationship("OwnershipEvent", back_populates="credit", cascade="all, delete-orphan")
    listings = relationship("MarketplaceListing", back_populates="credit", cascade="all, delete-orphan")
    pricing_results = relationship("PricingResult", back_populates="credit", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(String, primary_key=True, default=lambda: gen_id("EV"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    evidence_type = Column(String, nullable=False)
    source = Column(String, nullable=False)
    quality_score = Column(Float, default=70)  # 0-100
    hash = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="evidence")


class Audit(Base):
    __tablename__ = "audits"
    id = Column(String, primary_key=True, default=lambda: gen_id("AUD"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    defender_score = Column(Float, nullable=False)
    auditor_challenges = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    recommendation = Column(String, nullable=False)  # APPROVE / REQUIRES REVIEW / REJECT
    defender_statement = Column(Text, nullable=True)
    auditor_statement = Column(Text, nullable=True)
    anomaly_score = Column(Float, nullable=True)  # from IsolationForest, -1..1 (lower = more anomalous)
    narrative_source = Column(String, default="deterministic")  # "llm" or "deterministic" — never affects the fields above
    debate_turns = Column(JSON, nullable=True)
    ran_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="audits")
    findings = relationship("AuditFinding", back_populates="audit", cascade="all, delete-orphan")


class AuditFinding(Base):
    __tablename__ = "audit_findings"
    id = Column(String, primary_key=True, default=lambda: gen_id("FND"))
    audit_id = Column(String, ForeignKey("audits.id"), nullable=False)
    finding_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # LOW / MEDIUM / HIGH
    description = Column(Text, nullable=False)

    audit = relationship("Audit", back_populates="findings")


class StressTest(Base):
    __tablename__ = "stress_tests"
    id = Column(String, primary_key=True, default=lambda: gen_id("STR"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    scenario_name = Column(String, default="Custom Scenario")
    inputs = Column(JSON, nullable=False)  # dict of stress parameters
    base_risk = Column(Float, nullable=False)
    base_confidence = Column(Float, nullable=False)
    base_resilience = Column(Float, nullable=False)
    result_risk = Column(Float, nullable=False)
    result_confidence = Column(Float, nullable=False)
    result_resilience = Column(Float, nullable=False)
    result_value_impact_pct = Column(Float, nullable=False)
    ran_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="stress_tests")


class RiskScore(Base):
    __tablename__ = "risk_scores"
    id = Column(String, primary_key=True, default=lambda: gen_id("RSK"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    evidence_confidence = Column(Float, nullable=False)
    audit_confidence = Column(Float, nullable=False)
    data_consistency = Column(Float, nullable=False)
    resilience = Column(Float, nullable=False)
    composite_risk = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="risk_scores")


class RevalidationEvent(Base):
    __tablename__ = "revalidation_events"
    id = Column(String, primary_key=True, default=lambda: gen_id("RVL"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    trigger = Column(String, nullable=False)  # scheduled / manual / risk_triggered
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    confidence_before = Column(Float, nullable=True)
    confidence_after = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    ran_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="revalidation_events")


class IntegrityReview(Base):
    __tablename__ = "integrity_reviews"
    id = Column(String, primary_key=True, default=lambda: gen_id("IR"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    reason = Column(Text, nullable=False)
    triggered_by = Column(String, nullable=False)
    state = Column(Enum(IntegrityState), default=IntegrityState.FLAGGED)
    resolution_notes = Column(Text, nullable=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    credit = relationship("Credit", back_populates="integrity_reviews")


class OwnershipEvent(Base):
    __tablename__ = "ownership_events"
    id = Column(String, primary_key=True, default=lambda: gen_id("OWN"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    event_type = Column(String, nullable=False)  # ISSUED / TRANSFERRED / RETIRED
    from_owner = Column(String, nullable=True)
    to_owner = Column(String, nullable=True)
    quantity = Column(Float, nullable=False)
    tx_ref = Column(String, nullable=True)  # blockchain tx hash if available
    ts = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="ownership_events")


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"
    id = Column(String, primary_key=True, default=lambda: gen_id("LST"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    listed_price = Column(Float, nullable=False)
    quantity_available = Column(Float, nullable=False)
    active = Column(Boolean, default=True)
    listed_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="listings")


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"
    id = Column(String, primary_key=True, default=lambda: gen_id("BUY"))
    company = Column(String, nullable=False)
    budget_per_tonne = Column(Float, nullable=False)
    required_tco2e = Column(Float, nullable=False)
    geography_preference = Column(String, default="Any")
    project_type_preference = Column(String, default="Any")
    risk_tolerance = Column(String, default="Balanced")  # Conservative / Balanced / Aggressive
    confidence_requirement = Column(Float, default=60)
    sustainability_objective = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    match_results = relationship("MatchResult", back_populates="buyer", cascade="all, delete-orphan")


class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(String, primary_key=True, default=lambda: gen_id("MTC"))
    buyer_id = Column(String, ForeignKey("buyer_profiles.id"), nullable=False)
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    match_score = Column(Float, nullable=False)
    reasons = Column(JSON, nullable=False)  # list of strings
    computed_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship("BuyerProfile", back_populates="match_results")


class PricingResult(Base):
    __tablename__ = "pricing_results"
    id = Column(String, primary_key=True, default=lambda: gen_id("PRC"))
    credit_id = Column(String, ForeignKey("credits.id"), nullable=False)
    market_price = Column(Float, nullable=False)
    fair_value_low = Column(Float, nullable=False)
    fair_value_high = Column(Float, nullable=False)
    risk_adjustment_pct = Column(Float, nullable=False)
    explanation = Column(JSON, nullable=False)  # list of strings
    computed_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("Credit", back_populates="pricing_results")


class AuditLog(Base):
    """Immutable-style append-only action log for the whole platform."""
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True, default=lambda: gen_id("LOG"))
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    prev_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    ts = Column(DateTime, default=datetime.utcnow)
