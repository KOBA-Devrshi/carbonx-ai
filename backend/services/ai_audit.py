"""
AI vs AI Carbon Audit.

Two logical agents:
  DEFENDER — scores how well the claim is supported by its own data.
  AUDITOR  — runs concrete anomaly checks against the claim and flags
             findings; each finding is a real comparison against the
             submitted numbers, not a random number.

An IsolationForest anomaly score (scikit-learn) is layered on top of the
rule-based findings when there are enough historical credits to fit
against — this is the numerical ML component called for in the brief.

The DEBATE (this revision): rather than one static paragraph per side,
run_audit() now produces a multi-turn back-and-forth — the Defender opens,
the Auditor raises each finding in turn, the Defender responds to each,
and the Auditor closes with an overall verdict. This is built
deterministically from the same findings every time (so it always reads
like an actual argument, even with zero AI configured), and is optionally
handed to an LLM to be re-worded into more natural prose — the LLM never
invents a new finding, changes severity, or alters the numeric outcome;
it only rewrites the turns that were already deterministically generated.
"""
import os
import json
from typing import List, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest

from services import carbon_calculator as calc

OPENAI_AVAILABLE = bool(os.getenv("OPENAI_API_KEY"))
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")  # set to use Gemini/Groq/etc via their OpenAI-compatible endpoint


def defender_analysis(credit) -> Tuple[float, str]:
    summary = calc.summarize(
        credit.baseline_emissions, credit.reported_emissions,
        credit.production_baseline, credit.production_reported,
    )
    evidence_count = len(credit.evidence)
    avg_evidence_quality = (
        sum(e.quality_score for e in credit.evidence) / evidence_count if evidence_count else 0
    )
    reduction = summary["emission_reduction_pct"]
    prod_change = summary["production_change_pct"]
    mismatch_penalty = max(0, abs(reduction) - abs(prod_change) - 10) * 0.8
    evidence_bonus = min(evidence_count, 6) * 4 + avg_evidence_quality * 0.2
    score = 55 + evidence_bonus - mismatch_penalty
    score = round(max(5, min(99, score)), 1)

    statement = (
        f"Reported production change is {prod_change}%, with a filed emission "
        f"reduction of {reduction}% ({summary['net_reduction_tco2e']} tCO2e). "
        f"{evidence_count} evidence record(s) are attached with an average quality "
        f"score of {round(avg_evidence_quality,1)}. Baseline emission intensity was "
        f"{summary['baseline_intensity']} tCO2e/unit vs a reported intensity of "
        f"{summary['reported_intensity']} tCO2e/unit."
    )
    return score, statement


def auditor_findings(credit) -> Tuple[List[dict], str]:
    summary = calc.summarize(
        credit.baseline_emissions, credit.reported_emissions,
        credit.production_baseline, credit.production_reported,
    )
    reduction = summary["emission_reduction_pct"]
    prod_change = summary["production_change_pct"]
    findings = []

    if abs(reduction) - abs(prod_change) > 15:
        findings.append({
            "finding_type": "PRODUCTION_EMISSION_MISMATCH",
            "severity": "HIGH" if abs(reduction) - abs(prod_change) > 30 else "MEDIUM",
            "description": (
                f"Emission reduction of {abs(reduction)}% is materially larger than the "
                f"production change of {abs(prod_change)}%. This gap requires supporting "
                f"evidence (efficiency upgrades, fuel switching, etc.)."
            ),
        })

    if len(credit.evidence) < 3:
        findings.append({
            "finding_type": "MISSING_EVIDENCE",
            "severity": "MEDIUM",
            "description": f"Only {len(credit.evidence)} evidence record(s) on file — below the "
                            f"3-document minimum expected for a claim of this size.",
        })

    if credit.reported_emissions < 0 or credit.baseline_emissions < 0:
        findings.append({
            "finding_type": "IMPOSSIBLE_VALUE",
            "severity": "HIGH",
            "description": "Negative emission values detected in the submitted dataset.",
        })

    if credit.reported_emissions > credit.baseline_emissions:
        findings.append({
            "finding_type": "NO_NET_REDUCTION",
            "severity": "HIGH",
            "description": "Reported emissions exceed baseline emissions — no net reduction is "
                            "demonstrated by the submitted data.",
        })

    if credit.volume_tco2e > summary["net_reduction_tco2e"] * 1.15 and summary["net_reduction_tco2e"] > 0:
        findings.append({
            "finding_type": "VOLUME_MISMATCH",
            "severity": "MEDIUM",
            "description": f"Issued credit volume ({credit.volume_tco2e} tCO2e) exceeds the "
                            f"calculated net reduction ({summary['net_reduction_tco2e']} tCO2e) "
                            f"by more than 15% — possible over-issuance.",
        })

    if len(credit.evidence) and (sum(e.quality_score for e in credit.evidence) / len(credit.evidence)) < 45:
        findings.append({
            "finding_type": "LOW_EVIDENCE_QUALITY",
            "severity": "MEDIUM",
            "description": "Average evidence quality score is below 45 — source documents are "
                            "weak or unverified.",
        })

    if findings:
        statement = (
            f"{len(findings)} finding(s) raised. Highest severity: "
            f"{max(f['severity'] for f in findings)}. Auditor requests additional evidence "
            f"before this claim can be fully cleared."
        )
    else:
        statement = "No structural anomalies detected. Evidence set and claim magnitude are consistent."

    return findings, statement


def anomaly_score(credit, all_credits: List) -> float | None:
    if len(all_credits) < 4:
        return None
    X = []
    for c in all_credits:
        s = calc.summarize(c.baseline_emissions, c.reported_emissions,
                            c.production_baseline, c.production_reported)
        avg_q = (sum(e.quality_score for e in c.evidence) / len(c.evidence)) if c.evidence else 0
        X.append([s["emission_reduction_pct"], s["production_change_pct"], len(c.evidence), avg_q])
    X = np.array(X)
    model = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
    model.fit(X)
    idx = [c.id for c in all_credits].index(credit.id)
    score = float(model.decision_function(X)[idx])
    return round(score, 4)


# ---------------------------------------------------------------------------
# DEBATE — the actual multi-turn back-and-forth
# ---------------------------------------------------------------------------

DEFENDER_REBUTTALS = {
    "PRODUCTION_EMISSION_MISMATCH": (
        "That gap can be explained by factors independent of production volume — an "
        "efficiency upgrade, fuel switching, or a monitoring change made mid-period. "
        "We'd need the maintenance and utility records to confirm which."
    ),
    "MISSING_EVIDENCE": (
        "Additional source documents can be requested from the project developer — the "
        "current filing covers the primary calculation inputs, not every supporting record."
    ),
    "IMPOSSIBLE_VALUE": (
        "That looks like a data-entry error upstream rather than a fraudulent claim — it "
        "should be corrected and re-submitted, not treated as intentional misconduct yet."
    ),
    "NO_NET_REDUCTION": (
        "This is a serious discrepancy we can't argue around — it needs to go back to the "
        "developer for correction before this claim can proceed at all."
    ),
    "VOLUME_MISMATCH": (
        "Some buffer above the calculated reduction is normal to account for conservative "
        "rounding in the methodology, but this gap is wider than that alone would explain."
    ),
    "LOW_EVIDENCE_QUALITY": (
        "We can request a stronger evidence set — this doesn't necessarily mean the "
        "underlying claim is false, only that it isn't well-documented yet."
    ),
}


def build_deterministic_debate(defender_score: float, defender_opening: str,
                                findings: List[dict], auditor_closing: str) -> List[dict]:
    """Always available, no AI required — this alone fixes the 'it doesn't feel
    like a debate' problem, since even the fallback path now alternates turns
    instead of reading as two isolated paragraphs."""
    turns = [{"speaker": "defender", "text": defender_opening}]
    if not findings:
        turns.append({"speaker": "auditor", "text": auditor_closing})
        return turns
    for f in findings:
        turns.append({"speaker": "auditor", "text": f"{f['finding_type'].replace('_', ' ').title()} ({f['severity']}): {f['description']}"})
        turns.append({"speaker": "defender", "text": DEFENDER_REBUTTALS.get(
            f["finding_type"], "We'll need to look into that specific point further."
        )})
    turns.append({"speaker": "auditor", "text": auditor_closing})
    return turns


def llm_debate(credit, defender_score: float, findings: List[dict],
                deterministic_turns: List[dict]) -> Tuple[List[dict], bool]:
    """Asks the configured LLM to re-word the deterministic turns into more
    natural back-and-forth prose. The LLM receives the exact turn structure
    (who speaks, in what order, about which finding) and may only change the
    WORDING of each turn — never the number of turns, the speaker order, or
    which finding each turn addresses. If the LLM is unavailable, times out,
    returns malformed JSON, or changes the turn count, this falls back to the
    deterministic turns untouched. The audit's numeric outcome never depends
    on this function succeeding.
    """
    if not OPENAI_AVAILABLE:
        return deterministic_turns, False

    try:
        from openai import OpenAI
        client = OpenAI(timeout=10.0, base_url=OPENAI_BASE_URL) if OPENAI_BASE_URL else OpenAI(timeout=10.0)

        turns_json = json.dumps(deterministic_turns)
        system = (
            "You are rewording an already-decided carbon-credit audit debate for CarbonX. "
            "You will receive a JSON array of turns, each with a 'speaker' (defender or "
            "auditor) and 'text'. Rewrite ONLY the wording of each 'text' field to sound "
            "like a natural, slightly more conversational back-and-forth between the two "
            "roles — the Defender is arguing the claim is legitimate, the Auditor is "
            "pressing on the specific issue in that turn. Do NOT add, remove, or reorder "
            "turns. Do NOT change which speaker each turn belongs to. Do NOT invent new "
            "facts, numbers, or findings beyond what's in the original text. Return ONLY a "
            "JSON array in the exact same shape: [{\"speaker\": ..., \"text\": ...}, ...] "
            "with the same length as the input, nothing else — no markdown, no commentary."
        )
        user = f"Project: {credit.project.name} ({credit.project.project_type}). Turns:\n{turns_json}"

        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.5,
            max_tokens=800,
        )
        raw = (resp.choices[0].message.content or "").strip()
        # Strip accidental markdown code fences some models add despite instructions.
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw[raw.find("["):] if "[" in raw else raw

        parsed = json.loads(raw)
        if (
            isinstance(parsed, list)
            and len(parsed) == len(deterministic_turns)
            and all(isinstance(t, dict) and "speaker" in t and "text" in t for t in parsed)
            and all(parsed[i]["speaker"] == deterministic_turns[i]["speaker"] for i in range(len(parsed)))
        ):
            return parsed, True
        # Shape mismatch — LLM didn't follow the contract. Fall back rather
        # than risk a reordered or fabricated turn reaching the user.
        return deterministic_turns, False
    except Exception:
        return deterministic_turns, False


def run_audit(credit, all_credits: List) -> dict:
    defender_score, defender_statement = defender_analysis(credit)
    findings, auditor_statement = auditor_findings(credit)
    a_score = anomaly_score(credit, all_credits)

    challenge_penalty = sum({"LOW": 3, "MEDIUM": 7, "HIGH": 14}[f["severity"]] for f in findings)
    anomaly_penalty = 0
    if a_score is not None and a_score < 0:
        anomaly_penalty = min(15, abs(a_score) * 40)

    confidence = round(max(5, min(99, defender_score - challenge_penalty - anomaly_penalty)), 1)

    if confidence >= 80 and not any(f["severity"] == "HIGH" for f in findings):
        risk_level, recommendation = "LOW", "APPROVE"
    elif confidence >= 55:
        risk_level, recommendation = "MEDIUM", "REQUIRES REVIEW"
    elif confidence >= 35:
        risk_level, recommendation = "HIGH", "REQUIRES REVIEW"
    else:
        risk_level, recommendation = "CRITICAL", "REJECT"

    # Build the deterministic debate first — this is the source of truth for
    # structure (who speaks, how many turns, about which finding).
    deterministic_turns = build_deterministic_debate(defender_score, defender_statement, findings, auditor_statement)

    # Optionally re-word it via LLM — narrative only, same structure enforced.
    debate_turns, used_llm = llm_debate(credit, defender_score, findings, deterministic_turns)

    return {
        "defender_score": defender_score,
        "defender_statement": defender_statement,
        "auditor_statement": auditor_statement,
        "debate_turns": debate_turns,
        "findings": findings,
        "anomaly_score": a_score,
        "confidence_score": confidence,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "narrative_source": "llm" if used_llm else "deterministic",
    }