"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, CreditListItem } from "@/lib/api";
import { parseIntent, Intent } from "@/lib/agent/nlu";
import { AgentMessage, AgentMode, OrbState, PendingConfirmation, ToolStep } from "@/lib/agent/types";

type SpeechSettings = { voiceURI: string | null; rate: number; autoSpeak: boolean; voiceOn: boolean };

type AgentAPI = {
  mode: AgentMode; setMode: (m: AgentMode) => void;
  open: boolean; setOpen: (v: boolean) => void;
  messages: AgentMessage[];
  orbState: OrbState;
  sendText: (text: string) => void;
  micSupported: boolean;
  synthSupported: boolean;
  micState: "idle" | "listening" | "denied" | "unsupported";
  toggleListening: () => void;
  startPressToTalk: () => void;
  endPressToTalk: () => void;
  stopSpeaking: () => void;
  speechSettings: SpeechSettings;
  setSpeechSettings: (s: Partial<SpeechSettings>) => void;
  voices: SpeechSynthesisVoice[];
  selectedCreditName: string | null;
  micError: string | null;
};

const AgentCtx = createContext<AgentAPI | null>(null);
export const useAgent = () => {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<AgentMode>("chat");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    { id: uid(), role: "agent", text: "Hi — I'm the CarbonX Intelligence agent. Ask me to investigate a credit, run an audit, check pricing, or say \"give me the demo\".", ts: Date.now() },
  ]);
  const [orbState, setOrbState] = useState<OrbState>("idle");

  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [selectedCreditName, setSelectedCreditName] = useState<string | null>(null);
  const [lastFindings, setLastFindings] = useState<any[] | null>(null);
  const pendingRef = useRef<PendingConfirmation>(null);
  const creditsCache = useRef<CreditListItem[] | null>(null);

  const [speechSettings, setSpeechSettingsState] = useState<SpeechSettings>({ voiceURI: null, rate: 1.0, autoSpeak: true, voiceOn: true });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const setSpeechSettings = (s: Partial<SpeechSettings>) => setSpeechSettingsState((prev) => ({ ...prev, ...s }));

  const [micSupported, setMicSupported] = useState(false);
  const [synthSupported, setSynthSupported] = useState(false);
  const [micState, setMicState] = useState<"idle" | "listening" | "denied" | "unsupported">("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Track the credit currently open in the normal UI, so voice/text can
  // say "this one" without repeating the ID.
  useEffect(() => {
    const m = pathname?.match(/^\/credits\/([^/]+)/);
    if (m) {
      setSelectedCreditId(m[1]);
      api.getCredit(m[1]).then((c) => setSelectedCreditName(c.project.name)).catch(() => {});
    }
  }, [pathname]);

  // Feature detection — never assume support.
  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setMicSupported(!!SR);
    setMicState(SR ? "idle" : "unsupported");
    const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;
    setSynthSupported(hasSynth);
    if (hasSynth) {
      const load = () => setVoices(window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!synthSupported || !speechSettings.voiceOn || !text) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = speechSettings.rate;
      const voice = voices.find((v) => v.voiceURI === speechSettings.voiceURI);
      if (voice) utter.voice = voice;
      utter.onstart = () => setOrbState("speaking");
      utter.onend = () => { setOrbState("idle"); resolve(); };
      utter.onerror = () => { setOrbState("idle"); resolve(); };
      currentUtteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    });
  }

  function stopSpeaking() {
    if (synthSupported) window.speechSynthesis.cancel();
    setOrbState("idle");
  }

  function pushMessage(msg: Omit<AgentMessage, "id" | "ts">) {
    const full: AgentMessage = { ...msg, id: uid(), ts: Date.now() };
    setMessages((prev) => [...prev, full]);
    return full;
  }

  function updateSteps(msgId: string, steps: ToolStep[]) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, steps: [...steps] } : m)));
  }

  async function ensureCredits(): Promise<CreditListItem[]> {
    if (creditsCache.current) return creditsCache.current;
    const list = await api.listCredits();
    creditsCache.current = list;
    return list;
  }

  function findCredit(query: string, list: CreditListItem[]): CreditListItem | null {
    const q = query.toLowerCase();
    return (
      list.find((c) => c.id.toLowerCase() === q) ||
      list.find((c) => c.project_name.toLowerCase().includes(q)) ||
      null
    );
  }

  async function respond(text: string, opts?: { spoken?: string; actions?: { label: string; href: string }[]; steps?: ToolStep[] }) {
    const msg = pushMessage({ role: "agent", text, spoken: opts?.spoken, actions: opts?.actions, steps: opts?.steps });
    if (mode === "voice" && speechSettings.autoSpeak) await speak(opts?.spoken || text);
    return msg;
  }

  async function runWithSteps(labels: string[], fn: (update: (i: number, status: ToolStep["status"]) => void) => Promise<string>) {
    const steps: ToolStep[] = labels.map((l) => ({ label: l, status: "pending" }));
    const msg = pushMessage({ role: "agent", text: "Working…", steps });
    setOrbState("executing");
    const update = (i: number, status: ToolStep["status"]) => {
      steps[i] = { ...steps[i], status };
      updateSteps(msg.id, steps);
    };
    try {
      const finalText = await fn(update);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, text: finalText } : m)));
      setOrbState("idle");
      if (mode === "voice" && speechSettings.autoSpeak) await speak(finalText);
      return finalText;
    } catch (e: any) {
      const errText = `CarbonX Intelligence Service Unavailable — ${e.message || "the backend didn't respond"}. You can keep using text chat and try again.`;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, text: errText } : m)));
      setOrbState("error");
      setTimeout(() => setOrbState("idle"), 1500);
      return errText;
    }
  }

  async function execute(intent: Intent, rawText: string) {
    // Confirmation gate — locking/clearing always asks first.
    if (pendingRef.current) {
      if (intent.type === "CONFIRM") {
        const p = pendingRef.current; pendingRef.current = null;
        if (p.action === "flagIntegrity") {
          await runWithSteps(["Flagging credit", "Restricting marketplace trading"], async (update) => {
            update(0, "done");
            await api.flagIntegrity(p.creditId, p.detail, "CarbonX Agent");
            update(1, "done");
            return `Done. ${selectedCreditName || p.creditId} is now under Integrity Review — trading is restricted on CarbonX until it's cleared.`;
          });
        } else if (p.action === "clearIntegrity") {
          await runWithSteps(["Clearing integrity review", "Restoring trading"], async (update) => {
            update(0, "done");
            await api.integrityAction(p.creditId, "clear", "Cleared via CarbonX Agent", "CarbonX Agent");
            update(1, "done");
            return `Cleared. Trading is restored for ${selectedCreditName || p.creditId}.`;
          });
        }
        return;
      }
      if (intent.type === "CANCEL") {
        pendingRef.current = null;
        await respond("Okay, I won't do that.");
        return;
      }
      // Any other message clears the pending confirmation and falls through.
      pendingRef.current = null;
    }

    switch (intent.type) {
      case "NAVIGATE": {
        router.push(intent.destination);
        await respond(`Opening ${intent.label}.`);
        return;
      }

      case "RISKIEST": {
        await runWithSteps(["Loading credits", "Ranking by risk"], async (update) => {
          const list = await ensureCredits();
          update(0, "done");
          const worst = [...list].sort((a, b) => a.trust_score - b.trust_score)[0];
          update(1, "done");
          if (!worst) return "I don't see any credits in the system yet.";
          setSelectedCreditId(worst.id); setSelectedCreditName(worst.project_name);
          return `The riskiest credit right now is ${worst.project_name} (${worst.id}) — trust score ${worst.trust_score}, ${worst.risk_level} risk. Want me to investigate it?`;
        });
        return;
      }

      case "INVESTIGATE": {
        await runWithSteps(
          ["Finding credit", "Retrieved credit", "Ran AI audit", "Retrieved risk", "Retrieved DNA", "Checked blockchain status"],
          async (update) => {
            const list = await ensureCredits();
            const target = intent.creditQuery ? findCredit(intent.creditQuery, list) : (selectedCreditId ? list.find((c) => c.id === selectedCreditId) : null);
            update(0, "done");
            if (!target) return "I couldn't find a credit matching that. Try naming the project, e.g. \"investigate Reforestation Maharashtra\".";
            setSelectedCreditId(target.id); setSelectedCreditName(target.project_name);
            const detail = await api.getCredit(target.id); update(1, "done");
            const audit = await api.runAudit(target.id); update(2, "done");
            setLastFindings(audit.findings);
            update(3, "done"); // risk is embedded in the audit call's downstream recompute
            update(4, detail.dna_fingerprint ? "done" : "pending");
            const chain = await api.blockchainStatus().catch(() => null); update(5, "done");
            const findingText = audit.findings.length
              ? ` I found ${audit.findings.length} finding(s) — the most significant: ${audit.findings[0].description}`
              : " No structural anomalies were found.";
            return `Investigated ${target.project_name} (${target.id}). Audit recommendation: ${audit.recommendation}, confidence ${audit.confidence_score}%, risk ${audit.risk_level}.${findingText} Blockchain: ${chain?.status || "unknown"}.`;
          }
        );
        return;
      }

      case "AUDIT": {
        if (!selectedCreditId) { await respond("Which credit? Try \"investigate <project name>\" first, or open a credit from the marketplace."); return; }
        await runWithSteps(["Loading evidence", "Running Defender analysis", "Running Auditor challenge", "Computing confidence"], async (update) => {
          update(0, "done"); update(1, "done");
          const result = await api.runAudit(selectedCreditId);
          setLastFindings(result.findings);
          update(2, "done"); update(3, "done");
          const findingText = result.findings.length ? ` ${result.findings.length} finding(s) were raised — ask me "why" for detail.` : " No anomalies were found.";
          return `Audit complete on ${selectedCreditName || selectedCreditId}: ${result.recommendation}, confidence ${result.confidence_score}%, risk ${result.risk_level}.${findingText}`;
        });
        return;
      }

      case "VERIFY_DNA": {
        if (!selectedCreditId) { await respond("Which credit? Open one first or say \"investigate <project name>\"."); return; }
        await runWithSteps(["Computing canonical state", "Hashing (SHA-256)", "Comparing to stored fingerprint"], async (update) => {
          update(0, "done");
          await api.generateDNA(selectedCreditId);
          update(1, "done");
          const verify = await api.verifyDNA(selectedCreditId);
          update(2, "done");
          return verify.verified
            ? `Carbon DNA verified for ${selectedCreditName || selectedCreditId}. The fingerprint matches the credit's current recorded state.`
            : `DNA mismatch on ${selectedCreditName || selectedCreditId} — the underlying data has changed since the fingerprint was generated.`;
        });
        return;
      }

      case "STRESS_TEST": {
        if (!selectedCreditId) { await respond("Which credit? Open one first or say \"investigate <project name>\"."); return; }
        await runWithSteps(["Applying stress parameters", "Recomputing risk", "Recomputing resilience"], async (update) => {
          update(0, "done");
          const result = await api.runStressTest(selectedCreditId, {
            monitoring_failure_pct: 40, reversal_probability_pct: 25, production_change_pct: -15,
            evidence_degradation_pct: 15, extreme_weather_pct: 15, performance_decline_pct: 15, emission_increase_pct: 0,
          }, "Agent Scenario");
          update(1, "done"); update(2, "done");
          return `Stress test complete. Risk moved from ${result.base_risk} to ${result.result_risk}, confidence ${result.base_confidence} → ${result.result_confidence}, resilience now ${result.result_resilience}.`;
        });
        return;
      }

      case "REVALIDATE": {
        if (!selectedCreditId) { await respond("Which credit? Open one first."); return; }
        await runWithSteps(["Re-running audit pipeline", "Recalculating risk", "Updating lifecycle clock"], async (update) => {
          update(0, "done");
          const result = await api.runRevalidation(selectedCreditId);
          update(1, "done"); update(2, "done");
          return `Revalidation complete: ${result.previous_status} → ${result.new_status}, confidence ${result.confidence_before} → ${result.confidence_after}.`;
        });
        return;
      }

      case "LOCK": {
        if (!selectedCreditId) { await respond("Which credit should I lock? Open one first."); return; }
        const reason = lastFindings && lastFindings.length ? lastFindings[0].description : "Critical anomaly detected during agent-driven review";
        pendingRef.current = { action: "flagIntegrity", creditId: selectedCreditId, detail: reason };
        await respond(`Should I place ${selectedCreditName || selectedCreditId} under Integrity Review? This restricts trading on CarbonX until cleared. Say "confirm" to proceed.`);
        return;
      }

      case "CLEAR_LOCK": {
        if (!selectedCreditId) { await respond("Which credit should I clear? Open one first."); return; }
        pendingRef.current = { action: "clearIntegrity", creditId: selectedCreditId, detail: "" };
        await respond(`Clear the Integrity Review on ${selectedCreditName || selectedCreditId} and restore trading? Say "confirm" to proceed.`);
        return;
      }

      case "PRICING": {
        if (!selectedCreditId) { await respond("Which credit? Open one first or say \"investigate <project name>\"."); return; }
        await runWithSteps(["Reading evidence & audit confidence", "Computing risk-adjusted fair value"], async (update) => {
          update(0, "done");
          const p = await api.getPricing(selectedCreditId);
          update(1, "done");
          return `Market price is $${p.market_price}. CarbonX Fair Value is $${p.fair_value_low}–$${p.fair_value_high} (risk adjustment ${p.risk_adjustment_pct}%). ${p.explanation[0]}`;
        });
        return;
      }

      case "RISK_SUMMARY": {
        if (!selectedCreditId) { await respond("Which credit? Open one first or say \"investigate <project name>\"."); return; }
        await runWithSteps(["Reading current risk state"], async (update) => {
          const detail = await api.getCredit(selectedCreditId);
          update(0, "done");
          return `${selectedCreditName || selectedCreditId} has a trust score of ${detail.trust_score} and is currently classified ${detail.risk_level} risk. Verification status: ${detail.verification_status.replace(/_/g, " ")}.`;
        });
        return;
      }

      case "BLOCKCHAIN": {
        await runWithSteps(["Checking blockchain adapter status"], async (update) => {
          const status = await api.blockchainStatus();
          update(0, "done");
          return status.connected
            ? `Blockchain: connected to ${status.network}. Contract at ${status.contract_address}.`
            : `Blockchain is in Demo Mode — ${status.reason || "network credentials aren't configured"}. CarbonX's intelligence layer works fully either way.`;
        });
        return;
      }

      case "MATCHING": {
        await runWithSteps(["Scoring credits against buyer profile"], async (update) => {
          const result = await api.runMatching({
            company: "Agent Demo Buyer",
            budget_per_tonne: intent.budget || 18,
            required_tco2e: 500,
            geography_preference: "Any",
            project_type_preference: "Any",
            risk_tolerance: intent.risk || "Balanced",
            confidence_requirement: 60,
          });
          update(0, "done");
          if (!result.length) return "No matches came back for that profile.";
          const top = result[0];
          return `Best match: ${top.project_name} (${top.credit_id}) at ${top.match_score}% compatibility. ${top.reasons[0] || ""}`;
        });
        return;
      }

      case "WHY": {
        if (lastFindings && lastFindings.length) {
          await respond(`Here's why: ${lastFindings.map((f) => f.description).join(" ")}`);
        } else {
          await respond("I don't have a recent finding to explain yet — try \"run an audit\" first.");
        }
        return;
      }

      case "DEMO": {
        await runDemo();
        return;
      }

      case "HELP": {
        await respond(
          'Try: "open the marketplace", "investigate Reforestation Maharashtra", "run an audit", "verify its DNA", "stress test it", "lock this credit", "show its price", "check blockchain", "find the best credit for a low-risk buyer", or "give me the demo".'
        );
        return;
      }

      case "CONFIRM":
      case "CANCEL": {
        await respond("There's nothing pending to confirm right now.");
        return;
      }

      default: {
        await respond(`I'm not sure how to help with "${rawText}" yet. Say "help" to hear what I can do.`);
        return;
      }
    }
  }

  async function runDemo() {
    await respond("Absolutely. I'll walk you through the CarbonX trust lifecycle. Let's start with the marketplace.");
    router.push("/marketplace");
    await new Promise((r) => setTimeout(r, 600));

    const list = await ensureCredits().catch(() => []);
    const target = list.find((c) => c.project_name.toLowerCase().includes("reforestation")) || list[0];
    if (!target) { await respond("I couldn't find a demo credit to use — the database may be empty."); return; }
    setSelectedCreditId(target.id); setSelectedCreditName(target.project_name);

    await respond(`Now let's investigate ${target.project_name}.`);
    router.push(`/credits/${target.id}`);
    await new Promise((r) => setTimeout(r, 600));

    await respond("I'll verify its Carbon DNA.");
    await runWithSteps(["Generating fingerprint", "Verifying"], async (update) => {
      await api.generateDNA(target.id); update(0, "done");
      const v = await api.verifyDNA(target.id); update(1, "done");
      return v.verified ? "Carbon DNA verified." : "DNA mismatch detected.";
    });

    await respond("Now I'll challenge its assumptions with an AI audit.");
    await runWithSteps(["Defender analysis", "Auditor challenge"], async (update) => {
      update(0, "done");
      const a = await api.runAudit(target.id);
      setLastFindings(a.findings);
      update(1, "done");
      return `Audit result: ${a.recommendation}, confidence ${a.confidence_score}%, ${a.findings.length} finding(s).`;
    });

    await respond("Let's stress-test the credit.");
    await runWithSteps(["Applying stress scenario"], async (update) => {
      const s = await api.runStressTest(target.id, {
        monitoring_failure_pct: 45, reversal_probability_pct: 30, production_change_pct: -10,
        evidence_degradation_pct: 20, extreme_weather_pct: 15, performance_decline_pct: 15, emission_increase_pct: 0,
      }, "Demo Scenario");
      update(0, "done");
      return `Stress test complete. Risk moved from ${s.base_risk} to ${s.result_risk}, resilience now ${s.result_resilience}.`;
    });

    // stress result text already spoken by runWithSteps; decide on lock based on live credit state
    const refreshed = await api.getCredit(target.id).catch(() => null);
    if (refreshed && (refreshed.risk_level === "HIGH" || refreshed.risk_level === "CRITICAL")) {
      pendingRef.current = { action: "flagIntegrity", creditId: target.id, detail: "Critical risk detected during stress-test demo sequence" };
      await respond("The stress scenario significantly increases risk. Should I place this credit under Integrity Review? Say \"confirm\" to proceed.");
    } else {
      await respond("That completes the trust lifecycle walkthrough for this credit.");
    }
  }

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      pushMessage({ role: "user", text });
      setOrbState("thinking");
      const intent = parseIntent(text);
      setTimeout(() => execute(intent, text), 150);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCreditId, selectedCreditName, mode, speechSettings, voices, lastFindings]
  );

  // ---- Speech recognition ----
  function getRecognition(): SpeechRecognition | null {
    if (recognitionRef.current) return recognitionRef.current;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[e.results.length - 1][0].transcript;
      setMicState("idle");
      sendText(transcript);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setMicState(e.error === "not-allowed" ? "denied" : "idle");
      setMicError(e.error === "not-allowed" ? "Microphone permission was denied. You can continue using text chat." : `Voice input isn't available right now (${e.error}). You can continue using text chat.`);
    };
    rec.onend = () => setMicState((s) => (s === "listening" ? "idle" : s));
    recognitionRef.current = rec;
    return rec;
  }

  function toggleListening() {
    if (orbState === "speaking") stopSpeaking();
    if (!micSupported) { setMicError("Voice input isn't available in this browser. You can continue using text chat."); return; }
    const rec = getRecognition();
    if (!rec) return;
    if (micState === "listening") { rec.stop(); setMicState("idle"); return; }
    try {
      setMicError(null);
      rec.start();
      setMicState("listening");
      setOrbState("listening");
    } catch {
      /* already started */
    }
  }

  function startPressToTalk() {
    if (micState !== "listening") toggleListening();
  }
  function endPressToTalk() {
    if (micState === "listening") toggleListening();
  }

  const value: AgentAPI = {
    mode, setMode, open, setOpen, messages, orbState, sendText,
    micSupported, synthSupported, micState, toggleListening, startPressToTalk, endPressToTalk, stopSpeaking,
    speechSettings, setSpeechSettings, voices, selectedCreditName, micError,
  };

  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}
