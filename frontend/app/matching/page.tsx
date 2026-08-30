"use client";
import { useState } from "react";
import Link from "next/link";
import { api, MatchOut } from "@/lib/api";

export default function MatchingPage() {
  const [form, setForm] = useState({
    company: "Terna GreenTech Solutions", budget_per_tonne: 18, required_tco2e: 500,
    geography_preference: "Any", project_type_preference: "Any", risk_tolerance: "Balanced", confidence_requirement: 60,
  });
  const [matches, setMatches] = useState<MatchOut[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try { setMatches(await api.runMatching(form)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="my-9"><h2 className="font-sans text-2xl font-semibold">Buyer-Specific Credit Matching</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-sans font-semibold mb-3.5">Your requirements</div>
          <div className="field"><label>Company</label><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div className="field"><label>Budget per tCO2e ($)</label><input type="number" value={form.budget_per_tonne} onChange={(e) => setForm({ ...form, budget_per_tonne: parseFloat(e.target.value) || 0 })} /></div>
          <div className="field"><label>Target tCO2e</label><input type="number" value={form.required_tco2e} onChange={(e) => setForm({ ...form, required_tco2e: parseFloat(e.target.value) || 0 })} /></div>
          <div className="field"><label>Preferred geography</label>
            <select value={form.geography_preference} onChange={(e) => setForm({ ...form, geography_preference: e.target.value })}>
              {["Any", "Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field"><label>Project type</label>
            <select value={form.project_type_preference} onChange={(e) => setForm({ ...form, project_type_preference: e.target.value })}>
              {["Any", "Solar", "Wind", "Forestry", "Biogas", "Efficiency"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field"><label>Risk tolerance</label>
            <select value={form.risk_tolerance} onChange={(e) => setForm({ ...form, risk_tolerance: e.target.value })}>
              {["Conservative", "Balanced", "Aggressive"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field"><label>Confidence requirement (%)</label><input type="number" value={form.confidence_requirement} onChange={(e) => setForm({ ...form, confidence_requirement: parseFloat(e.target.value) || 0 })} /></div>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>Find matches</button>
          {error && <div className="text-danger text-[12.5px] mt-3">{error}</div>}
        </div>

        <div className="card">
          <div className="font-sans font-semibold mb-3.5">Top matches</div>
          {!matches && <div className="text-textFaint text-[13px] py-10 text-center">Fill in your requirements to see ranked, explained recommendations.</div>}
          {matches?.map((m, i) => (
            <div key={m.credit_id} className="py-3 border-t border-borderSoft first:border-t-0">
              <div className="flex justify-between items-center">
                <span className="font-sans font-semibold text-[14px]">{i + 1}. {m.project_name}</span>
                <span className="font-mono text-accent">{m.match_score}%</span>
              </div>
              <div className="text-textDim text-[12px] my-1">{m.credit_id}</div>
              <ul className="text-[12.5px] text-textDim list-disc list-inside">
                {m.reasons.map((r, j) => <li key={j}>{r}</li>)}
              </ul>
              <Link href={`/credits/${m.credit_id}`} className="btn btn-ghost btn-sm mt-2 inline-block">View credit</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
