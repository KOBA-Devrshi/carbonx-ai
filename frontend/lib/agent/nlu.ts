/**
 * Deterministic command parser. Keyword/regex based on purpose — the
 * previous scoping decision for this project was to keep all
 * financial/integrity-affecting logic deterministic (no LLM in the loop
 * deciding facts), and an offline ideathon demo with no guaranteed
 * internet makes that doubly true for the agent's understanding layer,
 * not just its backend. If an OPENAI_API_KEY-backed NLU is added later,
 * it should only ever produce the same {type, params} shape this parser
 * produces — never bypass it to touch state directly.
 */

export type Intent =
  | { type: "NAVIGATE"; destination: string; label: string }
  | { type: "INVESTIGATE"; creditQuery: string | null }
  | { type: "AUDIT" }
  | { type: "VERIFY_DNA" }
  | { type: "STRESS_TEST" }
  | { type: "REVALIDATE" }
  | { type: "LOCK" }
  | { type: "CLEAR_LOCK" }
  | { type: "PRICING" }
  | { type: "RISK_SUMMARY" }
  | { type: "BLOCKCHAIN" }
  | { type: "RISKIEST" }
  | { type: "MATCHING"; budget?: number; risk?: string }
  | { type: "WHY" }
  | { type: "DEMO" }
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "HELP" }
  | { type: "UNKNOWN"; raw: string };

const NAV_MAP: [RegExp, string, string][] = [
  [/\b(dashboard|command center|home base)\b/i, "/dashboard", "Dashboard"],
  [/\b(marketplace|market|listings)\b/i, "/marketplace", "Marketplace"],
  [/\b(matching|buyer match(ing)?)\b/i, "/matching", "Buyer Matching"],
  [/\b(ingestion|upload|csv)\b/i, "/ingestion", "Data Ingestion"],
  [/\b(admin|audit log|verification center)\b/i, "/admin", "Admin"],
  [/\b(landing|home|start)\b/i, "/", "Home"],
];

function extractNumber(text: string, keyword: RegExp): number | undefined {
  const m = text.match(new RegExp(keyword.source + "\\s*(?:of|is|=|:)?\\s*\\$?(\\d+)", "i"));
  return m ? parseFloat(m[1]) : undefined;
}

export function parseIntent(raw: string): Intent {
  const text = raw.trim().toLowerCase();
  if (!text) return { type: "UNKNOWN", raw };

  if (/\b(yes|confirm|do it|go ahead|proceed|sure)\b/.test(text) && text.length < 20) return { type: "CONFIRM" };
  if (/\b(no|cancel|stop|don'?t|nevermind)\b/.test(text) && text.length < 20) return { type: "CANCEL" };

  if (/\b(demo|tour|walk ?through|walk me through)\b/.test(text)) return { type: "DEMO" };
  if (/\b(help|what can you do|commands)\b/.test(text)) return { type: "HELP" };

  for (const [re, dest, label] of NAV_MAP) {
    if (/\b(go to|open|take me to|navigate to|show me)\b/.test(text) && re.test(text)) {
      return { type: "NAVIGATE", destination: dest, label };
    }
  }

  if (/\b(riskiest|highest risk|worst credit|most risky)\b/.test(text)) return { type: "RISKIEST" };

  if (/\b(investigate|look into|check out|tell me about)\b/.test(text)) {
    const m = text.match(/\b(?:investigate|look into|check out|tell me about)\s+(?:the\s+)?(.+)/);
    let query = m ? m[1].replace(/\bcredit\b/g, "").trim() : null;
    if (query) {
      // Strip a trailing period and collapse pronoun references ("this",
      // "this one", "it") down to null so the engine falls back to
      // whatever credit is already in context instead of literally
      // searching for the word "this".
      query = query.replace(/[.?!]+$/, "").trim();
      if (/^(this|this one|it|that)$/.test(query)) query = null;
    }
    return { type: "INVESTIGATE", creditQuery: query || null };
  }

  if (/\b(lock|flag|integrity review|restrict trading|kill switch)\b/.test(text)) return { type: "LOCK" };
  if (/\b(clear|unlock|restore trading|release)\b/.test(text)) return { type: "CLEAR_LOCK" };

  if (/\b(audit|challenge|defender|auditor)\b/.test(text)) return { type: "AUDIT" };
  if (/\b(dna|fingerprint|verify)\b/.test(text)) return { type: "VERIFY_DNA" };
  if (/\b(stress|simulate|scenario)\b/.test(text)) return { type: "STRESS_TEST" };
  if (/\b(revalidat)/.test(text)) return { type: "REVALIDATE" };
  if (/\b(price|pricing|value|worth|cost|fair value)\b/.test(text)) return { type: "PRICING" };
  if (/\b(blockchain|on.?chain|anchor|polygon)\b/.test(text)) return { type: "BLOCKCHAIN" };

  if (/\b(match|best credit|recommend|find.*(buyer|credit))\b/.test(text)) {
    const budget = extractNumber(text, /budget/i);
    const riskMatch = text.match(/\b(conservative|balanced|aggressive|low|medium|high)\b/);
    const riskMap: Record<string, string> = { low: "Conservative", medium: "Balanced", high: "Aggressive" };
    const risk = riskMatch ? riskMap[riskMatch[1]] || riskMatch[1][0].toUpperCase() + riskMatch[1].slice(1) : undefined;
    return { type: "MATCHING", budget, risk };
  }

  if (/\bwhy\b/.test(text)) return { type: "WHY" };

  if (/\brisk(y)?\b/.test(text)) return { type: "RISK_SUMMARY" };

  return { type: "UNKNOWN", raw };
}
