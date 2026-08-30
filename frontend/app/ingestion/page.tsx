"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

const SAMPLE_CSV = `project_id,project_name,project_type,location,baseline_emissions,reported_emissions,production,monitoring_date,evidence_score,verification_date,credit_volume,market_price
PRJ-901,Salem Cookstove Programme,Cookstove,"Salem, Tamil Nadu, IN",5200,4600,28000,2026-05-01,74,2026-05-10,600,9.8
PRJ-902,Suspicious Efficiency Claim,Efficiency,"Pune, Maharashtra, IN",9000,3200,50000,2026-04-01,40,2026-04-15,5800,11.2
`;

export default function IngestionPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true); setError(null); setResult(null);
    try { setResult(await api.ingestCSV(file)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  function useSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    upload(new File([blob], "sample-emissions.csv"));
  }

  return (
    <div>
      <div className="my-9"><h2 className="font-sans text-2xl font-semibold">Data Ingestion</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-sans font-semibold mb-2">Upload emission / project CSV</div>
          <div className="text-textDim text-[12.5px] mb-4">
            Required columns: project_type, location, baseline_emissions, reported_emissions, production,
            evidence_score, credit_volume, market_price. Optional: project_id, project_name, monitoring_date,
            verification_date.
          </div>
          <input
            ref={fileRef} type="file" accept=".csv"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-[13px] mb-3"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={useSample}>Use sample CSV</button>
          {busy && <div className="text-textDim text-[13px] mt-4">Validating schema, calculating emissions, running AI audit and generating Carbon DNA for each row…</div>}
          {error && <div className="text-danger text-[13px] mt-4">{error}</div>}
        </div>

        <div className="card">
          <div className="font-sans font-semibold mb-3">Pipeline result</div>
          {!result && <div className="text-textFaint text-[13px] py-10 text-center">Upload a CSV to run the full ingestion pipeline.</div>}
          {result && (
            <>
              <div className="text-[13px] text-textDim mb-3">
                {result.created.length} credit(s) created · {result.row_errors.length} row error(s)
              </div>
              {result.created.map((c: any) => (
                <div key={c.credit_id} className="py-3 border-t border-borderSoft first:border-t-0">
                  <div className="flex justify-between">
                    <span className="font-sans font-semibold text-[13.5px]">{c.project_name}</span>
                    <span className="font-mono text-[12px]">{c.trust_score}% · {c.risk_level}</span>
                  </div>
                  <div className="text-textDim text-[12px] mt-1">
                    {c.audit_recommendation} · {c.findings} finding(s)
                  </div>
                  <Link href={`/credits/${c.credit_id}`} className="btn btn-ghost btn-sm mt-2 inline-block">Open credit</Link>
                </div>
              ))}
              {result.row_errors.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-surface2 border border-dangerDim">
                  <div className="text-danger text-[12.5px] font-semibold mb-1.5">Row errors</div>
                  {result.row_errors.map((e: string, i: number) => <div key={i} className="text-[12px] text-textDim">{e}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
