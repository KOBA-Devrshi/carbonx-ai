"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, CreditListItem } from "@/lib/api";

export default function AdminPage() {
  const [credits, setCredits] = useState<CreditListItem[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [chain, setChain] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listCredits(), api.auditLog(40), api.blockchainStatus()])
      .then(([c, l, b]) => { setCredits(c); setLog(l); setChain(b); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-24 text-center text-textFaint">Loading admin center…</div>;

  const review = credits.filter(
    (c) => c.integrity_state === "INTEGRITY_REVIEW" || c.verification_status === "UNDER_REVIEW" || c.revalidation_status !== "TRUSTED"
  );

  return (
    <div>
      <div className="my-9"><h2 className="font-sans text-2xl font-semibold">Admin / Verification Center</h2></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Awaiting Review</div><div className="font-sans text-2xl font-semibold mt-2">{review.length}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Integrity Locks</div><div className="font-sans text-2xl font-semibold mt-2">{credits.filter((c) => c.integrity_state === "INTEGRITY_REVIEW").length}</div></div>
        <div className="card"><div className="font-mono text-[11px] uppercase text-textFaint">Total Credits</div><div className="font-sans text-2xl font-semibold mt-2">{credits.length}</div></div>
        <div className="card">
          <div className="font-mono text-[11px] uppercase text-textFaint">Blockchain</div>
          <div className="font-sans text-base font-semibold mt-2">{chain?.status}</div>
          <div className="text-textFaint text-[11px] mt-1">{chain?.reason}</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="font-sans font-semibold mb-3">Verification queue</div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[10.5px] uppercase text-textFaint">
              <th className="py-2.5">Credit</th><th>Status</th><th>Trust</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {review.map((c) => (
              <tr key={c.id} className="border-t border-borderSoft">
                <td className="py-2.5 font-mono">{c.id}</td>
                <td>{c.integrity_state === "INTEGRITY_REVIEW" ? <span className="badge badge-high">INTEGRITY REVIEW</span> : <span className="badge badge-medium">{c.verification_status.replace(/_/g," ")}</span>}</td>
                <td>{c.trust_score}</td>
                <td><Link href={`/credits/${c.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
              </tr>
            ))}
            {review.length === 0 && <tr><td colSpan={4} className="text-center text-textFaint py-8">Nothing needs review right now.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="font-sans font-semibold mb-3">Platform audit log</div>
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase text-textFaint">
              <th className="py-2">Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id} className="border-t border-borderSoft">
                <td className="py-2 font-mono text-textFaint">{new Date(l.ts).toLocaleString()}</td>
                <td>{l.actor}</td>
                <td>{l.action}</td>
                <td className="font-mono">{l.entity}</td>
                <td className="text-textDim">{l.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
