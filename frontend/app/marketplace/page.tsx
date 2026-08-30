"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, CreditListItem } from "@/lib/api";
import { RiskBadge, StatRow } from "@/components/UI";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

export default function MarketplacePage() {
  const [credits, setCredits] = useState<CreditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState("Any");
  const [typeFilter, setTypeFilter] = useState("Any");
  const [sort, setSort] = useState("trust");

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true); setError(null);
    api.marketplaceListings().then(setCredits).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  if (loading) return <LoadingState label="Loading marketplace…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const types = ["Any", ...Array.from(new Set(credits.map((c) => c.project_type)))];
  let list = credits;
  if (riskFilter !== "Any") list = list.filter((c) => c.risk_level === riskFilter);
  if (typeFilter !== "Any") list = list.filter((c) => c.project_type === typeFilter);
  list = [...list].sort((a, b) =>
    sort === "trust" ? b.trust_score - a.trust_score : sort === "price" ? a.market_price - b.market_price : b.available_tco2e - a.available_tco2e
  );

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-3 my-9">
        <h2 className="font-sans text-2xl font-semibold">Marketplace</h2>
        <span className="text-textDim text-[13px]">{list.length} listings available</span>
      </div>

      <div className="card flex gap-3.5 flex-wrap items-end mb-5">
        <div className="field mb-0 min-w-[160px]">
          <label>Project type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field mb-0 min-w-[160px]">
          <label>Risk level</label>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            {["Any", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field mb-0 min-w-[160px]">
          <label>Sort by</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="trust">Trust score</option>
            <option value="price">Price (low→high)</option>
            <option value="qty">Availability</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {list.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-accent text-[13px]">{c.id}</span>
                <h4 className="font-sans text-[15.5px] mt-1">{c.project_name}</h4>
                <div className="text-textDim text-xs mt-0.5">{c.location}</div>
              </div>
              <RiskBadge level={c.risk_level} />
            </div>
            <div>
              <StatRow k="Type" v={c.project_type} />
              <StatRow k="Available" v={`${c.available_tco2e.toLocaleString()} tCO2e`} />
              <StatRow k="Market Price" v={`$${c.market_price}`} />
              <StatRow k="Trust Score" v={`${c.trust_score}%`} />
              <StatRow k="Verification" v={c.verification_status.replace(/_/g, " ")} />
            </div>
            <div className="flex gap-2 flex-wrap mt-1">
              <Link href={`/credits/${c.id}?tab=dna`} className="btn btn-ghost btn-sm">View DNA</Link>
              <Link href={`/credits/${c.id}?tab=audit`} className="btn btn-ghost btn-sm">Challenge</Link>
              <Link href={`/credits/${c.id}`} className="btn btn-primary btn-sm">View &amp; Buy</Link>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-3"><EmptyState message="No listings match these filters." /></div>}
      </div>
    </div>
  );
}
