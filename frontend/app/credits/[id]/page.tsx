"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, CreditDetail, AuditResult, StressTestResult, PricingOut, TimelineEvent, BlockchainStatus, DebateTurn } from "@/lib/api";
import { RiskBadge, StatusBadge, StatRow, TrustBar } from "@/components/UI";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const TABS: [string, string][] = [
  ["overview", "Overview"], ["dna", "Carbon DNA"], ["audit", "AI vs AI Audit"],
  ["stress", "Stress Test"], ["revalidation", "Revalidation"], ["integrity", "Integrity Lock"],
  ["pricing", "Pricing"], ["blockchain", "Blockchain"],
];

export default function CreditDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const [tab, setTab] = useState(search.get("tab") || "overview");
  const [credit, setCredit] = useState<CreditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.getCredit(id).then(setCredit).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <LoadingState label="Loading credit intelligence…" />;
  if (error || !credit) return <ErrorState message={error || "Credit not found."} onRetry={reload} />;

  return (
    <div>
      <div className="flex justify-between items-start flex-wrap gap-3 my-9">
        <div>
          <div className="font-mono text-accent text-[13px]">{credit.id} · {credit.project.methodology}</div>
          <h2 className="font-sans text-2xl font-semibold mt-1">{credit.project.name}</h2>
          <div className="text-textDim text-[13px] mt-1">
            {credit.project.location} · {credit.project.project_type} · Developer: {credit.project.developer}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <RiskBadge level={credit.risk_level} />
          {credit.integrity_state === "INTEGRITY_REVIEW" && <span className="badge badge-high">INTEGRITY LOCKED</span>}
        </div>
      </div>

      <TrustTimeline creditId={credit.id} />

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-[13px] font-medium px-4 py-2.5 border-b-2 whitespace-nowrap ${
              tab === k ? "text-accent border-accent" : "text-textDim border-transparent hover:text-text"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview credit={credit} reload={reload} />}
      {tab === "dna" && <DNA credit={credit} reload={reload} />}
      {tab === "audit" && <Audit creditId={credit.id} reload={reload} />}
      {tab === "stress" && <Stress creditId={credit.id} riskLevel={credit.risk_level} trust={credit.trust_score} />}
      {tab === "revalidation" && <Revalidation creditId={credit.id} reload={reload} />}
      {tab === "integrity" && <Integrity credit={credit} reload={reload} />}
      {tab === "pricing" && <Pricing creditId={credit.id} />}
      {tab === "blockchain" && <Blockchain credit={credit} />}
    </div>
  );
}

function TrustTimeline({ creditId }: { creditId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  useEffect(() => { api.timeline(creditId).then(setEvents).catch(() => setEvents([])); }, [creditId]);

  if (!events) return null;
  return (
    <div className="card mb-2 overflow-x-auto">
      <div className="font-mono text-[10.5px] uppercase tracking-wide text-textFaint mb-3">Trust Timeline · {events.length} real event(s)</div>
      <div className="flex gap-4 min-w-max pb-1">
        {events.map((e, i) => (
          <div key={i} className="flex flex-col items-start gap-1 min-w-[150px] border-l-2 border-accentDim pl-3">
            <span className="font-mono text-[9.5px] text-textFaint">{new Date(e.ts).toLocaleString()}</span>
            <span className="font-mono text-[9px] uppercase text-accent">{e.stage}</span>
            <span className="text-[12px] font-medium leading-tight">{e.title}</span>
            <span className="text-[11px] text-textDim leading-tight">{e.detail}</span>
          </div>
        ))}
        {events.length === 0 && <span className="text-textFaint text-[12px]">No lifecycle events recorded yet.</span>}
      </div>
    </div>
  );
}

function Overview({ credit, reload }: { credit: CreditDetail; reload: () => void }) {
  const [qty, setQty] = useState(50);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    setBusy(true); setMsg(null);
    try {
      const res = await api.purchase(credit.id, qty, "Demo Buyer");
      setMsg(`Demo transaction confirmed — $${res.total} for ${qty} tCO2e.`);
      reload();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function retire() {
    setBusy(true); setMsg(null);
    try {
      const res = await api.retire(credit.id, Math.min(qty, 20), "Terna Engineering College", "Voluntary offset for campus operations");
      setMsg(`Retirement certificate ${res.certificate_id} generated.`);
      reload();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Volume Issued</div><div className="font-sans text-2xl font-semibold mt-2">{credit.volume_tco2e.toLocaleString()}</div><div className="text-[12px] text-textDim mt-1">tCO2e</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Available</div><div className="font-sans text-2xl font-semibold mt-2">{credit.available_tco2e.toLocaleString()}</div><div className="text-[12px] text-textDim mt-1">tCO2e listed</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Trust Score</div><div className="font-sans text-2xl font-semibold mt-2">{credit.trust_score}</div><div className="text-[12px] text-textDim mt-1">{credit.risk_level} risk</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="font-sans font-semibold mb-3">Evidence on file ({credit.evidence.length})</div>
          {credit.evidence.map((e) => (
            <StatRow key={e.id} k={`${e.evidence_type} — ${e.source}`} v={`Q${e.quality_score}`} />
          ))}
          {credit.evidence.length === 0 && <div className="text-textFaint text-[13px]">No evidence on file yet.</div>}
        </div>
        <div className="card">
          <div className="font-sans font-semibold mb-3">Buy or retire this credit</div>
          <div className="field"><label>Quantity (tCO2e)</label><input type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} /></div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" disabled={busy || credit.integrity_state === "INTEGRITY_REVIEW" || credit.available_tco2e <= 0} onClick={buy}>
              Buy credits
            </button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={retire}>Retire credits (demo)</button>
          </div>
          {credit.integrity_state === "INTEGRITY_REVIEW" && (
            <div className="text-danger text-[12px] mt-2.5">Trading restricted — credit is under Integrity Review.</div>
          )}
          {msg && <div className="text-accent text-[12.5px] mt-3 font-mono">{msg}</div>}
        </div>
      </div>
    </div>
  );
}

function DNA({ credit, reload }: { credit: CreditDetail; reload: () => void }) {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try { setResult(await api.generateDNA(credit.id)); reload(); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true);
    try { setResult(await api.verifyDNA(credit.id)); } catch (e: any) { setResult({ error: e.message }); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="font-sans font-semibold">Carbon DNA Fingerprint</div>
            <div className="text-textDim text-[13px] mt-1">A deterministic SHA-256 hash over this credit&apos;s canonicalized project, evidence and audit state.</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={generate}>{credit.dna_fingerprint ? "Regenerate" : "Generate"} DNA</button>
            <button className="btn btn-ghost btn-sm" disabled={busy || !credit.dna_fingerprint} onClick={verify}>Verify Carbon DNA</button>
          </div>
        </div>
        {credit.dna_fingerprint && (
          <div className="mt-4 font-mono text-[12px] text-accent break-all bg-surface2 border border-border rounded-lg p-3">
            {credit.dna_fingerprint}
          </div>
        )}
        {result && !result.error && (
          <div className={`mt-3 text-[12.5px] font-mono ${result.verified ? "text-accent" : "text-danger"}`}>
            {result.verified ? "✓ Fingerprint matches current state." : "⚠ Fingerprint MISMATCH — underlying data changed since last generation."}
          </div>
        )}
        {result?.error && <div className="mt-3 text-[12.5px] text-danger">{result.error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="font-sans font-semibold mb-3">Record</div>
          <StatRow k="Credit ID" v={credit.id} />
          <StatRow k="Project ID" v={credit.project.id} />
          <StatRow k="Location" v={credit.project.location} />
          <StatRow k="Reporting period" v={credit.reporting_period} />
          <StatRow k="Owner" v={credit.owner} />
          <StatRow k="Methodology" v={credit.project.methodology} />
        </div>
        <div className="card">
          <div className="font-sans font-semibold mb-3">Evidence graph</div>
          {credit.evidence.map((e) => (
            <StatRow key={e.id} k={`${e.evidence_type} — ${e.source}`} v={e.hash || "—"} />
          ))}
        </div>
      </div>
    </div>
  );
}

const PROCESSING_STAGES = [
  "Analyzing evidence...",
  "Checking baseline...",
  "Scanning for anomalies...",
  "Comparing reported vs. production data...",
  "Evaluating consistency...",
];

const SUGGESTED_QUESTIONS = [
  "Is this credit risky?",
  "What evidence do you have?",
  "How could this improve?",
  "Should I buy it?",
];

type QAPair = { question: string; answer: string; source: string };

function Audit({ creditId, reload }: { creditId: string; reload: () => void }) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageText, setStageText] = useState<string | null>(null);
  const [visibleTurns, setVisibleTurns] = useState<DebateTurn[]>([]);
  const [typingSpeaker, setTypingSpeaker] = useState<"defender" | "auditor" | null>(null);
  const [autoLocked, setAutoLocked] = useState(false);

  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    api.latestAudit(creditId).then((r) => {
      setResult(r);
      setVisibleTurns(r.debate_turns && r.debate_turns.length > 0
        ? r.debate_turns
        : [
            { speaker: "defender" as const, text: r.defender_statement },
            { speaker: "auditor" as const, text: r.auditor_statement },
          ]);
    }).catch(() => {});
  }, [creditId]);

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setVisibleTurns([]);
    setTypingSpeaker(null);
    setQaHistory([]);
    setAutoLocked(false);

    let stageIndex = 0;
    setStageText(PROCESSING_STAGES[0]);
    const stageInterval = setInterval(() => {
      stageIndex = (stageIndex + 1) % PROCESSING_STAGES.length;
      setStageText(PROCESSING_STAGES[stageIndex]);
    }, 550);

    try {
      const fullResult = await api.runAudit(creditId);
      clearInterval(stageInterval);
      setStageText(null);

      const turns: DebateTurn[] =
        fullResult.debate_turns && fullResult.debate_turns.length > 0
          ? fullResult.debate_turns
          : [
              { speaker: "defender" as const, text: fullResult.defender_statement },
              { speaker: "auditor" as const, text: fullResult.auditor_statement },
            ];

      for (const turn of turns) {
        setTypingSpeaker(turn.speaker);
        await sleep(700 + Math.random() * 500);
        setTypingSpeaker(null);
        setVisibleTurns((prev) => [...prev, turn]);
        await sleep(150);
      }

      setResult(fullResult);

      if (fullResult.recommendation === "REJECT") {
        try {
          const topFinding = fullResult.findings?.[0]?.description || "Critical anomaly detected by AI Auditor.";
          await api.flagIntegrity(
            creditId,
            `Auto-locked by AI Auditor: REJECT verdict at ${fullResult.confidence_score}% confidence. ${topFinding}`,
            "AI Auditor (auto)"
          );
          setAutoLocked(true);
          reload();
        } catch {
        }
      }
    } catch (e: any) {
      clearInterval(stageInterval);
      setStageText(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function askQuestion(q: string) {
    if (!q.trim() || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const res = await api.askDefender(creditId, q);
      setQaHistory((prev) => [...prev, { question: q, answer: res.answer, source: res.source || "System Defender" }]);
      setQuestion("");
    } catch (e: any) {
      setAskError(e.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-sans font-semibold">AI vs AI Carbon Audit</div>
          <div className="text-textDim text-[13px]">The Defender argues the claim is supported; the Auditor challenges it point by point. A REJECT verdict automatically triggers the Integrity Lock — enforced by the backend, not just shown in the UI.</div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={run}>{result || visibleTurns.length ? "Re-run audit" : "Start audit"}</button>
      </div>

      {error && <div className="text-danger text-[12.5px] mt-3">{error}</div>}

      {autoLocked && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-dangerDim flex items-center gap-2">
          <span className="text-danger">🔒</span>
          <div className="text-[13px] text-danger">
            <span className="font-semibold">Integrity Lock auto-triggered.</span> The AI Auditor&apos;s REJECT verdict has restricted trading on this credit — check the Integrity Lock tab. This was enforced by the backend, not a display-only warning.
          </div>
        </div>
      )}

      {busy && stageText && (
        <div className="mt-4 flex items-center gap-2 text-textDim text-[12.5px] font-mono">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          {stageText}
        </div>
      )}

      {(visibleTurns.length > 0 || typingSpeaker) && (
        <>
          {result && (
            <div className="flex justify-between items-center mt-4 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wide text-textFaint">Debate transcript</span>
              <span className={`badge ${result.narrative_source === "llm" ? "badge-low" : "badge-neutral"}`}>
                {result.narrative_source === "llm" ? "AI-narrated" : "Deterministic"}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 my-3">
            {visibleTurns.map((turn, i) => {
              const isDefender = turn.speaker === "defender";
              return (
                <div
                  key={i}
                  className={`max-w-[85%] p-3.5 rounded-xl text-[13.5px] leading-relaxed border ${
                    isDefender
                      ? "self-start border-accentDim bg-surface2"
                      : "self-end border-dangerDim bg-surface2"
                  }`}
                >
                  <span className={`block font-mono text-[10px] tracking-wide uppercase mb-1.5 ${isDefender ? "text-accent" : "text-danger"}`}>
                    {isDefender ? "AI Defender" : "AI Auditor"}
                  </span>
                  {turn.text}
                </div>
              );
            })}

            {typingSpeaker && (
              <div
                className={`max-w-[40%] p-3 rounded-xl border text-[12px] ${
                  typingSpeaker === "defender"
                    ? "self-start border-accentDim bg-surface2 text-accent"
                    : "self-end border-dangerDim bg-surface2 text-danger"
                }`}
              >
                <span className="font-mono text-[10px] uppercase">
                  {typingSpeaker === "defender" ? "AI Defender" : "AI Auditor"} is typing
                  <span className="inline-block animate-pulse">...</span>
                </span>
              </div>
            )}
          </div>

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Result</div><div className={`font-sans text-lg font-semibold mt-1.5 ${result.recommendation === "REJECT" ? "text-danger" : ""}`}>{result.recommendation}</div></div>
              <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Confidence</div><div className="font-sans text-lg font-semibold mt-1.5">{result.confidence_score}%</div></div>
              <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Risk</div><div className="font-sans text-lg font-semibold mt-1.5">{result.risk_level}</div></div>
              <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Anomaly Score</div><div className="font-sans text-lg font-semibold mt-1.5">{result.anomaly_score ?? "n/a"}</div></div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-border">
            <div className="font-sans font-semibold text-[14px] mb-1">Ask the Defender</div>
            <div className="text-textDim text-[12.5px] mb-3">
              Ask anything about this credit — the answer is grounded in the audit above, not a generic chatbot.
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {SUGGESTED_QUESTIONS.map((sq) => (
                <button
                  key={sq}
                  className="btn btn-ghost btn-sm"
                  disabled={asking}
                  onClick={() => askQuestion(sq)}
                >
                  {sq}
                </button>
              ))}
            </div>

            {qaHistory.length > 0 && (
              <div className="flex flex-col gap-3 mb-3">
                {qaHistory.map((qa, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="self-end max-w-[85%] px-3 py-2 rounded-lg bg-accent/10 border border-accentDim text-[13px]">
                      {qa.question}
                    </div>
                    <div className="self-start max-w-[85%] px-3 py-2.5 rounded-lg bg-surface2 border border-border text-[13px] leading-relaxed">
                      <span className="block font-mono text-[9.5px] uppercase text-accent mb-1">
                        AI Defender {qa.source === "llm" ? "· AI-narrated" : "· deterministic"}
                      </span>
                      {qa.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {asking && (
              <div className="text-textDim text-[12px] font-mono mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Defender is thinking...
              </div>
            )}
            {askError && <div className="text-danger text-[12px] mb-2">{askError}</div>}

            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") askQuestion(question); }}
                placeholder="Ask your own question..."
                className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accentDim"
              />
              <button className="btn btn-primary btn-sm" disabled={asking} onClick={() => askQuestion(question)}>
                Ask
              </button>
            </div>
          </div>
        </>
      )}

      {!busy && !result && visibleTurns.length === 0 && (
        <div className="text-textFaint text-center py-10">No audit has been run yet for this credit.</div>
      )}
    </div>
  );
}

const SLIDER_KEYS: [string, string][] = [
  ["production_change_pct", "📉 Production change (%, ± )"],
  ["emission_increase_pct", "🔥 Emission increase (%)"],
  ["monitoring_failure_pct", "📡 Monitoring failure"],
  ["evidence_degradation_pct", "📄 Evidence degradation"],
  ["extreme_weather_pct", "🌧 Extreme weather"],
  ["reversal_probability_pct", "🌳 Reversal probability"],
  ["performance_decline_pct", "⚙ Performance decline"],
];

function Stress({ creditId, riskLevel, trust }: { creditId: string; riskLevel: string; trust: number }) {
  const [inputs, setInputs] = useState<Record<string, number>>({
    production_change_pct: -10, emission_increase_pct: 0, monitoring_failure_pct: 20,
    evidence_degradation_pct: 10, extreme_weather_pct: 15, reversal_probability_pct: 10, performance_decline_pct: 15,
  });
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try { setResult(await api.runStressTest(creditId, inputs, "Custom Scenario")); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="card">
        <div className="font-sans font-semibold">How could this credit fail?</div>
        <div className="text-textDim text-[13px] mb-4">Move the parameters, then run the simulation — every result below is computed from your inputs.</div>
        {SLIDER_KEYS.map(([key, label]) => (
          <div key={key} className="mb-5">
            <div className="flex justify-between text-[13px] mb-2"><span>{label}</span><span className="font-mono">{inputs[key]}%</span></div>
            <input
              type="range" min={key === "production_change_pct" ? -50 : 0} max={key === "production_change_pct" ? 50 : 100}
              value={inputs[key]} onChange={(e) => setInputs({ ...inputs, [key]: parseInt(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>
        ))}
        <button className="btn btn-primary" disabled={busy} onClick={run}>Run stress test</button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Risk Before → After</div><div className="font-sans text-lg font-semibold mt-1.5">{result.base_risk} → {result.result_risk}</div></div>
            <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Confidence Before → After</div><div className="font-sans text-lg font-semibold mt-1.5">{result.base_confidence} → {result.result_confidence}</div></div>
            <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Resilience</div><div className="font-sans text-lg font-semibold mt-1.5">{result.result_resilience}</div></div>
            <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Value Impact</div><div className="font-sans text-lg font-semibold mt-1.5">{result.result_value_impact_pct}%</div></div>
          </div>
        </>
      )}
    </div>
  );
}

function Revalidation({ creditId, reload }: { creditId: string; reload: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);

  const load = useCallback(() => { api.revalidationStatus(creditId).then(setStatus); }, [creditId]);
  useEffect(() => { load(); }, [load]);

  async function run() {
    setBusy(true);
    try { const r = await api.runRevalidation(creditId); setLastRun(r); load(); reload(); } finally { setBusy(false); }
  }

  if (!status) return <div className="text-textFaint py-10 text-center">Loading…</div>;

  return (
    <div className="card">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <div className="font-sans font-semibold">Evidence revalidation clock</div>
          <div className="text-textDim text-[12.5px]">Not a legal expiration — a trust refresh checkpoint.</div>
        </div>
        <StatusBadge status={status.status} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Last Validated</div><div className="font-sans text-base font-semibold mt-1.5">{new Date(status.last_validated_at).toLocaleDateString()}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Next Review</div><div className="font-sans text-base font-semibold mt-1.5">{new Date(status.next_review_at).toLocaleDateString()}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Days Until Review</div><div className="font-sans text-base font-semibold mt-1.5">{status.days_until_review}</div></div>
      </div>
      <button className="btn btn-primary mt-4" disabled={busy} onClick={run}>Run Revalidation</button>
      {lastRun && (
        <div className="mt-4 text-[13px] font-mono text-accent">
          {lastRun.previous_status} → {lastRun.new_status} · confidence {lastRun.confidence_before} → {lastRun.confidence_after}
        </div>
      )}
    </div>
  );
}

function Integrity({ credit, reload }: { credit: CreditDetail; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("Duplicate reporting period detected across two registry submissions");

  async function flag() {
    setBusy(true);
    try { await api.flagIntegrity(credit.id, reason, "AI Auditor"); reload(); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try { await api.integrityAction(credit.id, "clear", "Manual review completed", "Admin"); reload(); } finally { setBusy(false); }
  }
  async function escalate() {
    setBusy(true);
    try { await api.integrityAction(credit.id, "escalate", "Escalated to senior review", "Admin"); reload(); } finally { setBusy(false); }
  }

  if (credit.integrity_state !== "INTEGRITY_REVIEW") {
    return (
      <div className="card">
        <div className="text-textFaint text-center py-6">No open integrity review — platform trading is unrestricted.</div>
        <div className="field"><label>Trigger a review (for demo purposes)</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={flag}>Flag for Integrity Review</button>
      </div>
    );
  }

  return (
    <div className="card border-dangerDim">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <div className="font-sans font-semibold text-danger">⚠ Credit under Integrity Review</div>
          <div className="text-textDim text-[12.5px] max-w-lg mt-1">
            Platform-level trading control only — CarbonX does not legally cancel or destroy certified credits.
          </div>
        </div>
        <span className="badge badge-high">RESTRICTED</span>
      </div>
      <div className="mt-4">
        <StatRow k="Reason" v={credit.integrity_reason || "—"} />
        <StatRow k="Trading Status" v="RESTRICTED" />
      </div>
      <div className="flex gap-2 flex-wrap mt-4">
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={escalate}>Escalate</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={clear}>Clear (admin)</button>
      </div>
    </div>
  );
}

function Blockchain({ credit }: { credit: CreditDetail }) {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.blockchainStatus().then(setStatus).catch((e) => setError(e.message)); }, []);

  return (
    <div className="card">
      <div className="font-sans font-semibold mb-1">Blockchain Verification</div>
      <div className="text-textDim text-[13px] mb-4 max-w-lg">
        Blockchain enhances integrity. It does not define the intelligence layer — every score, audit
        and price on this page comes from CarbonX&apos;s own backend, with or without a blockchain connection.
      </div>

      {error && <div className="text-danger text-[12.5px]">{error}</div>}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-surface2">
            <div className="font-mono text-[11px] uppercase text-textFaint">Status</div>
            <div className={`font-sans text-xl font-semibold mt-1.5 ${status.connected ? "text-accent" : "text-amber"}`}>
              {status.connected ? "CONNECTED" : "DEMO MODE"}
            </div>
            <div className="text-textDim text-[12px] mt-1">{status.network}</div>
          </div>
          <div className="card bg-surface2">
            <StatRow k="Contract Address" v={status.contract_address || "Not connected"} />
            <StatRow k="Reason" v={status.reason || "—"} />
            <StatRow k="Carbon DNA Fingerprint" v={credit.dna_fingerprint ? credit.dna_fingerprint.slice(0, 18) + "…" : "Not generated"} />
          </div>
        </div>
      )}

      <div className="mt-4 text-[12px] text-textFaint">
        {status?.connected
          ? "Carbon DNA generation and lifecycle events (integrity flags, ownership transfers) are anchored on-chain."
          : "Set POLYGON_RPC_URL, POLYGON_PRIVATE_KEY and CARBON_DNA_CONTRACT_ADDRESS in backend/.env to enable live testnet anchoring — no frontend changes needed."}
      </div>
    </div>
  );
}

function Pricing({ creditId }: { creditId: string }) {
  const [pricing, setPricing] = useState<PricingOut | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { setBusy(true); api.getPricing(creditId).then(setPricing).finally(() => setBusy(false)); }, [creditId]);
  useEffect(() => { load(); }, [load]);

  if (!pricing) return <div className="text-textFaint py-10 text-center">{busy ? "Computing fair value…" : "No pricing yet."}</div>;

  return (
    <div className="card">
      <div className="flex justify-between items-center">
        <div className="font-sans font-semibold">Risk-adjusted pricing</div>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={load}>Recompute</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Market Price</div><div className="font-sans text-xl font-semibold mt-1.5">${pricing.market_price}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">CarbonX Fair Value</div><div className="font-sans text-lg font-semibold mt-1.5">${pricing.fair_value_low} – ${pricing.fair_value_high}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Risk Adjustment</div><div className="font-sans text-xl font-semibold mt-1.5">{pricing.risk_adjustment_pct}%</div></div>
      </div>
      <div className="mt-4">
        <div className="font-sans font-semibold mb-2">Why this range</div>
        {pricing.explanation.map((r, i) => <div key={i} className="text-[13px] py-1.5 border-t border-borderSoft first:border-t-0">{r}</div>)}
      </div>
      <div className="text-textFaint text-[11.5px] mt-3">This is a CarbonX Fair Value Estimate — not a regulated market price.</div>
    </div>
  );
}