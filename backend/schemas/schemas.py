from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ProjectOut(BaseModel):
    id: str
    name: str
    project_type: str
    developer: str
    location: str
    methodology: str
    demo_data: bool

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    id: str
    evidence_type: str
    source: str
    quality_score: float
    hash: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class EvidenceIn(BaseModel):
    evidence_type: str
    source: str
    quality_score: float = Field(70, ge=0, le=100)


class CreditOut(BaseModel):
    id: str
    project: ProjectOut
    reporting_period: str
    baseline_emissions: float
    reported_emissions: float
    production_baseline: float
    production_reported: float
    volume_tco2e: float
    available_tco2e: float
    market_price: float
    owner: str
    verification_status: str
    revalidation_status: str
    integrity_state: str
    integrity_reason: Optional[str]
    trust_score: float
    risk_level: str
    dna_fingerprint: Optional[str]
    dna_verified_at: Optional[datetime]
    issued_at: datetime
    last_validated_at: datetime
    next_review_at: datetime
    evidence: List[EvidenceOut] = []

    class Config:
        from_attributes = True


class CreditListItem(BaseModel):
    id: str
    project_name: str
    project_type: str
    location: str
    volume_tco2e: float
    available_tco2e: float
    market_price: float
    trust_score: float
    risk_level: str
    verification_status: str
    revalidation_status: str
    integrity_state: str

    class Config:
        from_attributes = True


class CreditCreate(BaseModel):
    project_id: str
    reporting_period: str
    baseline_emissions: float
    reported_emissions: float
    production_baseline: float
    production_reported: float
    volume_tco2e: float
    market_price: float


class DNAResponse(BaseModel):
    credit_id: str
    fingerprint: str
    canonical_payload: Dict[str, Any]
    verified: bool
    computed_at: datetime
    blockchain: Optional[Dict[str, Any]] = None


class AuditFindingOut(BaseModel):
    finding_type: str
    severity: str
    description: str

    class Config:
        from_attributes = True


class AuditResult(BaseModel):
    id: str
    credit_id: str
    defender_score: float
    auditor_challenges: int
    confidence_score: float
    risk_level: str
    recommendation: str
    defender_statement: str
    auditor_statement: str
    anomaly_score: Optional[float]
    narrative_source: str = "deterministic"
    debate_turns: list = []        # <-- ADD THIS LINE
    findings: List[AuditFindingOut]
    ran_at: datetime

    class Config:
        from_attributes = True


class StressTestRequest(BaseModel):
    production_change_pct: float = 0        # negative = decrease
    emission_increase_pct: float = 0
    monitoring_failure_pct: float = 0        # 0-100
    evidence_degradation_pct: float = 0      # 0-100
    extreme_weather_pct: float = 0           # 0-100
    reversal_probability_pct: float = 0      # 0-100
    performance_decline_pct: float = 0       # 0-100
    scenario_name: Optional[str] = "Custom Scenario"


class StressTestResult(BaseModel):
    id: str
    credit_id: str
    scenario_name: str
    inputs: Dict[str, Any]
    base_risk: float
    base_confidence: float
    base_resilience: float
    result_risk: float
    result_confidence: float
    result_resilience: float
    result_value_impact_pct: float
    ran_at: datetime

    class Config:
        from_attributes = True


class RevalidationResult(BaseModel):
    id: str
    credit_id: str
    trigger: str
    previous_status: Optional[str]
    new_status: Optional[str]
    confidence_before: Optional[float]
    confidence_after: Optional[float]
    notes: Optional[str]
    ran_at: datetime

    class Config:
        from_attributes = True


class IntegrityActionRequest(BaseModel):
    action: str  # "clear" | "escalate"
    resolution_notes: Optional[str] = None
    actor: str = "Admin"


class IntegrityReviewOut(BaseModel):
    id: str
    credit_id: str
    reason: str
    triggered_by: str
    state: str
    resolution_notes: Optional[str]
    opened_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class BuyerProfileIn(BaseModel):
    company: str
    budget_per_tonne: float
    required_tco2e: float
    geography_preference: str = "Any"
    project_type_preference: str = "Any"
    risk_tolerance: str = "Balanced"
    confidence_requirement: float = 60
    sustainability_objective: Optional[str] = None


class MatchOut(BaseModel):
    credit_id: str
    project_name: str
    match_score: float
    reasons: List[str]


class PricingOut(BaseModel):
    credit_id: str
    market_price: float
    fair_value_low: float
    fair_value_high: float
    risk_adjustment_pct: float
    explanation: List[str]
    evidence_confidence: float
    project_risk: str
    stress_resilience: float
    audit_confidence: float


class PurchaseRequest(BaseModel):
    quantity: float
    buyer: str = "Demo Buyer"


class RetireRequest(BaseModel):
    quantity: float
    beneficiary: str
    reason: str


class CSVIngestRow(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    project_type: str
    location: str
    baseline_emissions: float
    reported_emissions: float
    production: float
    monitoring_date: Optional[str] = None
    evidence_score: float = 70
    verification_date: Optional[str] = None
    credit_volume: float
    market_price: float


class TimelineEvent(BaseModel):
    ts: datetime
    stage: str            # EVIDENCE / DNA / AUDIT / STRESS / REVALIDATION / INTEGRITY / OWNERSHIP / BLOCKCHAIN
    title: str
    detail: str
    status: Optional[str] = None


class DashboardSummary(BaseModel):

    total_credits: int
    verified_credits: int
    under_review_credits: int
    average_confidence: float
    average_risk: float
    total_tco2e_tracked: float
    total_market_value: float
    revalidation_due: int
    by_status: Dict[str, int]
    by_risk: Dict[str, int]
