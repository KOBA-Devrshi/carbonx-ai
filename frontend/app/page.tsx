"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import CarbonCoreWrapper from "@/components/CarbonCoreWrapper";

const LIFECYCLE = [
  "DATA", "EVIDENCE", "CARBON DNA", "AI DEFENDER", "AI AUDITOR", "RISK",
  "STRESS TEST", "REVALIDATION", "INTEGRITY", "PRICE", "MATCHING", "TRADE",
];

const PROBLEMS = [
  ["Fragmented evidence", "Claims scattered across PDFs, spreadsheets and portals with no single verifiable record."],
  ["Inconsistent reporting", "Production and emissions numbers that don't reconcile — and nobody checking that they should."],
  ["Hidden risk", "A credit's real exposure to monitoring failure, reversal or weak evidence stays invisible until it's too late."],
  ["Stale verification", "A trust score computed once at issuance and never revisited."],
  ["Weak buyer-credit fit", "Generic listings with no accounting for a specific buyer's risk tolerance or objectives."],
  ["No dynamic valuation", "One market price, no accounting for evidence quality or resilience under stress."],
];

const FEATURES: [string, string, string, string][] = [
  ["01", "🧬 Carbon DNA Fingerprint", "A deterministic SHA-256 fingerprint over the credit's canonicalized identity, evidence and audit state — recomputable and verifiable at any time.", "/marketplace"],
  ["02", "🤖 AI vs AI Carbon Audit", "A Defender and an Auditor score every claim from its own submitted data, backed by real anomaly checks and an IsolationForest model.", "/marketplace"],
  ["03", "🔥 Stress Test", "Simulate monitoring failure, extreme weather, production shocks and reversal risk — watch risk, confidence and resilience move live.", "/marketplace"],
  ["04", "⏱ Revalidation Clock", "A trust-refresh checkpoint, not a legal expiry. Run revalidation on demand and the audit + risk pipeline re-executes for real.", "/marketplace"],
  ["05", "🔒 Integrity Lock", "A platform-level trading restriction with a real state machine — ACTIVE → FLAGGED → INTEGRITY REVIEW → CLEARED.", "/admin"],
  ["06", "🎯 Buyer Matching", "A weighted scoring algorithm over budget, risk tolerance, geography, project type and confidence — with explained results.", "/matching"],
  ["07", "💰 Risk-Adjusted Pricing", "CarbonX Fair Value: market price adjusted for evidence confidence, project risk, stress resilience and data quality.", "/marketplace"],
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function LandingPage() {
  return (
    <div>
      <section className="pt-20 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-accent border border-accentDim px-3 py-1.5 rounded-full bg-accent/10">
            ● The Trust &amp; Intelligence Layer for Carbon Markets
          </span>
          <h1 className="font-sans font-bold text-[40px] md:text-[60px] leading-[0.98] tracking-tight mt-6 mb-5">
            Don&apos;t just trade a<br />
            carbon credit. <span className="bg-gradient-to-r from-accent to-[#8ef0c4] bg-clip-text text-transparent">Challenge it.</span>
          </h1>
          <p className="text-lg text-textDim max-w-xl mb-8 leading-relaxed">
            CarbonX runs a real adversarial AI audit, a real stress test, and a real risk-adjusted
            pricing engine on every credit — connected as one lifecycle, backed by a live FastAPI
            service layer, not static mock screens.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/marketplace" className="btn btn-primary">Enter Carbon Intelligence →</Link>
            <Link href="/dashboard" className="btn btn-secondary">Explore the Trust Layer</Link>
          </div>
        </div>
        <div className="glass rounded-2xl">
          <CarbonCoreWrapper />
        </div>
      </section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} className="py-16">
        <span className="font-mono text-xs tracking-widest uppercase text-danger">The Problem</span>
        <h2 className="font-sans text-[28px] font-semibold mt-2 mb-2 max-w-2xl">
          Carbon markets don&apos;t only have a liquidity problem. They have a trust problem.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {PROBLEMS.map(([t, d]) => (
            <div key={t} className="card">
              <div className="font-sans font-semibold text-[14.5px] mb-1.5">{t}</div>
              <div className="text-textDim text-[13px] leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} className="py-6">
        <h2 className="font-sans text-[26px] font-semibold mb-1.5">The CarbonX Trust Lifecycle</h2>
        <p className="text-textDim text-[14.5px] mb-7 max-w-xl">
          One connected pipeline — changing an upstream variable (evidence quality, an audit finding)
          moves everything downstream: risk, resilience, price, and who this credit should be matched to.
        </p>
        <div className="flex items-center overflow-x-auto py-6 px-6 bg-surface border border-border rounded-2xl gap-0">
          {LIFECYCLE.map((s, i) => (
            <span key={s} className="flex items-center">
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="font-mono text-xs tracking-wide text-textDim whitespace-nowrap px-3.5 py-1.5 rounded-full border border-borderSoft"
              >
                {s}
              </motion.span>
              {i < LIFECYCLE.length - 1 && <span className="text-textFaint px-1.5">→</span>}
            </span>
          ))}
        </div>
      </motion.section>

      <section className="py-10">
        <h2 className="font-sans text-[26px] font-semibold mb-1.5">The seven-part trust engine</h2>
        <p className="text-textDim text-[14.5px] mb-7 max-w-xl">
          Every credit moves through the same real backend pipeline: issued, challenged, stress-tested,
          continuously revalidated, and priced for its actual risk.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map(([n, t, d, href]) => (
            <Link key={n} href={href} className="card hover:border-accentDim transition-colors block">
              <span className="font-mono text-accent text-xs tracking-wider">{n}</span>
              <h3 className="font-sans text-[16.5px] mt-2.5 mb-2">{t}</h3>
              <p className="text-[13.5px] text-textDim leading-relaxed">{d}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 border border-dashed border-border rounded-xl px-5 py-4.5 text-[12.5px] text-textFaint leading-relaxed">
        <span className="text-text">Demo environment —</span> CarbonX is an ideathon prototype. Emission
        calculations, audits, trust scores, pricing and blockchain records are computed by real backend
        logic against synthetic demo data. Blockchain anchoring reports Demo Mode unless Polygon
        credentials are configured — CarbonX&apos;s intelligence layer works fully either way. Nothing
        shown constitutes a certified carbon credit or financial advice.
      </div>
    </div>
  );
}
