const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export type CreditListItem = {
  id: string;
  project_name: string;
  project_type: string;
  location: string;
  volume_tco2e: number;
  available_tco2e: number;
  market_price: number;
  trust_score: number;
  risk_level: string;
  verification_status: string;
  revalidation_status: string;
  integrity_state: string;
};

export type Evidence = {
  id: string; evidence_type: string; source: string; quality_score: number; hash: string | null; uploaded_at: string;
};

export type CreditDetail = CreditListItem & {
  project: { id: string; name: string; project_type: string; developer: string; location: string; methodology: string; demo_data: boolean };
  reporting_period: string;
  baseline_emissions: number;
  reported_emissions: number;
  production_baseline: number;
  production_reported: number;
  owner: string;
  integrity_reason: string | null;
  dna_fingerprint: string | null;
  dna_verified_at: string | null;
  issued_at: string;
  last_validated_at: string;
  next_review_at: string;
  evidence: Evidence[];
};

export type AuditFinding = { finding_type: string; severity: string; description: string };
export type DebateTurn = { speaker: "defender" | "auditor"; text: string };

export type AuditResult = {
  id: string; credit_id: string; defender_score: number; auditor_challenges: number;
  confidence_score: number; risk_level: string; recommendation: string;
  defender_statement: string; auditor_statement: string; anomaly_score: number | null;
  narrative_source?: string; debate_turns?: DebateTurn[];
  findings: AuditFinding[]; ran_at: string;
};

export type StressTestResult = {
  id: string; credit_id: string; scenario_name: string; inputs: Record<string, number>;
  base_risk: number; base_confidence: number; base_resilience: number;
  result_risk: number; result_confidence: number; result_resilience: number;
  result_value_impact_pct: number; ran_at: string;
};

export type PricingOut = {
  credit_id: string; market_price: number; fair_value_low: number; fair_value_high: number;
  risk_adjustment_pct: number; explanation: string[]; evidence_confidence: number;
  project_risk: string; stress_resilience: number; audit_confidence: number;
};

export type DashboardSummary = {
  total_credits: number; verified_credits: number; under_review_credits: number;
  average_confidence: number; average_risk: number; total_tco2e_tracked: number;
  total_market_value: number; revalidation_due: number;
  by_status: Record<string, number>; by_risk: Record<string, number>;
};

export type DNAResponse = {
  credit_id: string; fingerprint: string; canonical_payload: Record<string, any>;
  verified: boolean; computed_at: string; blockchain?: BlockchainStatus | null;
};
export type MatchOut = { credit_id: string; project_name: string; match_score: number; reasons: string[] };
export type TimelineEvent = { ts: string; stage: string; title: string; detail: string; status: string | null };
export type BlockchainStatus = { connected: boolean; network: string; contract_address: string | null; tx_hash: string | null; block_number?: number | null; status: string; reason: string | null };

export const api = {
  listCredits: (params?: Record<string, string>) =>
    request<CreditListItem[]>(`/api/credits${params ? "?" + new URLSearchParams(params) : ""}`),
  getCredit: (id: string) => request<CreditDetail>(`/api/credits/${id}`),
  addEvidence: (id: string, evidence_type: string, source: string, quality_score = 70) =>
    request<Evidence>(`/api/credits/${id}/evidence`, { method: "POST", body: JSON.stringify({ evidence_type, source, quality_score }) }),
  generateDNA: (id: string) => request<DNAResponse>(`/api/credits/${id}/dna/generate`, { method: "POST" }),
  verifyDNA: (id: string) => request<DNAResponse>(`/api/credits/${id}/dna/verify`, { method: "POST" }),

  runAudit: (id: string) => request<AuditResult>(`/api/audit/${id}/run`, { method: "POST" }),
  latestAudit: (id: string) => request<AuditResult>(`/api/audit/${id}/latest`),

  runStressTest: (id: string, inputs: Record<string, number>, scenario_name: string) =>
    request<StressTestResult>(`/api/stress-test/${id}/run`, { method: "POST", body: JSON.stringify({ ...inputs, scenario_name }) }),

  revalidationStatus: (id: string) => request<any>(`/api/revalidation/${id}/status`),
  runRevalidation: (id: string) => request<any>(`/api/revalidation/${id}/run`, { method: "POST" }),

  flagIntegrity: (id: string, reason: string, triggered_by = "AI Auditor") =>
    request(`/api/integrity/${id}/flag?${new URLSearchParams({ reason, triggered_by })}`, { method: "POST" }),
  integrityAction: (id: string, action: "clear" | "escalate", resolution_notes = "", actor = "Admin") =>
    request(`/api/integrity/${id}/action`, { method: "POST", body: JSON.stringify({ action, resolution_notes, actor }) }),

  runMatching: (payload: any) => request<MatchOut[]>("/api/matching/run", { method: "POST", body: JSON.stringify(payload) }),

  getPricing: (id: string) => request<PricingOut>(`/api/pricing/${id}`),

  marketplaceListings: () => request<CreditListItem[]>("/api/marketplace/listings"),
  purchase: (id: string, quantity: number, buyer = "Demo Buyer") =>
    request<any>(`/api/marketplace/${id}/purchase`, { method: "POST", body: JSON.stringify({ quantity, buyer }) }),
  retire: (id: string, quantity: number, beneficiary: string, reason: string) =>
    request<any>(`/api/marketplace/${id}/retire`, { method: "POST", body: JSON.stringify({ quantity, beneficiary, reason }) }),
  lifecycle: (id: string) => request<any[]>(`/api/marketplace/${id}/lifecycle`),
  timeline: (id: string) => request<TimelineEvent[]>(`/api/credits/${id}/timeline`),

  ingestCSV: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/ingestion/csv`, { method: "POST", body: form }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || "Ingestion failed");
      return body;
    });
  },

  dashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  blockchainStatus: () => request<BlockchainStatus>("/api/system/blockchain/status"),
  auditLog: (limit = 100) => request<any[]>(`/api/system/audit-log?limit=${limit}`),
};

export { API_URL };
