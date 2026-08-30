export function RiskBadge({ level }: { level: string }) {
  const cls =
    level === "LOW" ? "badge-low" : level === "MEDIUM" ? "badge-medium" : "badge-high";
  return <span className={`badge ${cls}`}>{level}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const positive = ["CARBONX_VERIFIED", "TRUSTED", "CLEARED", "ACTIVE", "APPROVE"];
  const negative = ["INTEGRITY_REVIEW", "REJECT", "REVALIDATION_DUE"];
  const cls = positive.includes(status) ? "badge-low" : negative.includes(status) ? "badge-high" : "badge-medium";
  return <span className={`badge ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="font-mono text-[11px] tracking-wide uppercase text-textFaint">{label}</div>
      <div className="font-sans text-[28px] font-semibold mt-2">{value}</div>
      {sub && <div className="text-[12px] text-textDim mt-1.5">{sub}</div>}
    </div>
  );
}

export function TrustBar({ label, value, weightPct }: { label: string; value: number; weightPct?: number }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-[13px] mb-2">
        <span>
          {label} {weightPct !== undefined && <span className="text-textFaint">({weightPct}%)</span>}
        </span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function StatRow({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between text-[12.5px] py-1.5 border-t border-borderSoft first:border-t-0">
      <span className="text-textFaint">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
