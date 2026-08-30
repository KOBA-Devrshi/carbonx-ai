"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardSummary, CreditListItem } from "@/lib/api";
import { MetricCard, RiskBadge } from "@/components/UI";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const RISK_COLORS: Record<string, string> = { LOW: "#4CE0A0", MEDIUM: "#F2C14E", HIGH: "#FF6B6B", CRITICAL: "#B33939" };

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [credits, setCredits] = useState<CreditListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([api.dashboardSummary(), api.listCredits()])
      .then(([s, c]) => { setSummary(s); setCredits(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error || !summary) return <ErrorState message={error || "No data returned."} onRetry={load} />;

  const riskData = Object.entries(summary.by_risk).map(([name, value]) => ({ name, value }));
  const attention = credits.filter(
    (c) => c.integrity_state === "INTEGRITY_REVIEW" || c.risk_level === "HIGH" || c.risk_level === "CRITICAL" || c.revalidation_status !== "TRUSTED"
  );

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-3 my-9">
        <h2 className="font-sans text-2xl font-semibold">Carbon Intelligence Dashboard</h2>
        <span className="font-mono text-xs text-textDim">Live from {summary.total_credits} tracked credits</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Credits" value={summary.total_credits} sub="across seeded + ingested projects" />
        <MetricCard label="tCO2e Tracked" value={summary.total_tco2e_tracked.toLocaleString()} sub="issued volume" />
        <MetricCard label="Avg Confidence" value={`${summary.average_confidence}%`} sub="weighted trust score" />
        <MetricCard label="Under Review" value={summary.under_review_credits} sub="integrity + verification" />
        <MetricCard label="Market Value" value={`$${summary.total_market_value.toLocaleString()}`} sub="volume × market price" />
        <MetricCard label="Avg Risk" value={`${summary.average_risk}%`} sub="100 − avg confidence" />
        <MetricCard label="Revalidation Due" value={summary.revalidation_due} sub="needs a trust refresh" />
        <MetricCard label="CarbonX Verified" value={summary.verified_credits} sub="audit-approved credits" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="font-sans font-semibold mb-4">Risk distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {riskData.map((d) => (
                  <Cell key={d.name} fill={RISK_COLORS[d.name] || "#8FA79C"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#122019", border: "1px solid #1C2A24" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="font-sans font-semibold mb-4">Market price vs CarbonX volume</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={credits.slice(0, 6).map((c) => ({ name: c.id.replace("CX-", "").slice(0, 6), price: c.market_price, trust: c.trust_score }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2A24" />
              <XAxis dataKey="name" stroke="#5C7268" fontSize={11} />
              <YAxis stroke="#5C7268" fontSize={11} />
              <Tooltip contentStyle={{ background: "#122019", border: "1px solid #1C2A24" }} />
              <Bar dataKey="price" fill="#4CE0A0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-between items-end my-8">
        <h2 className="font-sans text-xl font-semibold">Credits requiring attention</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {attention.length === 0 && <div className="text-textFaint py-10 text-center col-span-3">No credits currently need attention.</div>}
        {attention.map((c) => (
          <Link key={c.id} href={`/credits/${c.id}`} className="card block hover:border-accentDim transition-colors">
            <div className="flex justify-between items-center">
              <span className="font-mono text-accent text-[13px]">{c.id}</span>
              <RiskBadge level={c.risk_level} />
            </div>
            <div className="mt-2 text-[13.5px]">{c.project_name}</div>
            <div className="text-textDim text-[12px] mt-1.5">Confidence: {c.trust_score}%</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
