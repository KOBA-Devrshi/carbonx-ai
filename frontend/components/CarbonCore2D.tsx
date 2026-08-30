"use client";
import Link from "next/link";

const NODES: { label: string; href: string; angle: number; color: string }[] = [
  { label: "Evidence", href: "/marketplace", angle: 0, color: "#4CE0A0" },
  { label: "Carbon DNA", href: "/marketplace", angle: 45, color: "#4CE0A0" },
  { label: "AI Audit", href: "/marketplace", angle: 90, color: "#FF6B6B" },
  { label: "Risk", href: "/marketplace", angle: 135, color: "#F2C14E" },
  { label: "Stress", href: "/marketplace", angle: 180, color: "#F2C14E" },
  { label: "Revalidation", href: "/marketplace", angle: 225, color: "#4CE0A0" },
  { label: "Integrity", href: "/admin", angle: 270, color: "#FF6B6B" },
  { label: "Market", href: "/marketplace", angle: 315, color: "#2DD4BF" },
];

export default function CarbonCore2D() {
  const R = 150;
  const C = 200;
  return (
    <div className="w-full h-[420px] md:h-[480px] flex items-center justify-center">
      <svg viewBox="0 0 400 400" className="w-full max-w-[420px] h-auto">
        <circle cx={C} cy={C} r={70} fill="#122019" stroke="#4CE0A0" strokeOpacity={0.4} strokeWidth={1} />
        <circle cx={C} cy={C} r={95} fill="none" stroke="#1C2A24" strokeWidth={1} strokeDasharray="2 4" />
        {NODES.map((n, i) => {
          const rad = (n.angle * Math.PI) / 180;
          const x = C + Math.cos(rad) * R;
          const y = C + Math.sin(rad) * R;
          return (
            <g key={i}>
              <line x1={C} y1={C} x2={x} y2={y} stroke={n.color} strokeOpacity={0.2} strokeWidth={1} />
              <Link href={n.href}>
                <circle cx={x} cy={y} r={7} fill={n.color} className="cursor-pointer">
                  <animate attributeName="r" values="6;8;6" dur="3s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                </circle>
                <text x={x} y={y + 20} textAnchor="middle" fontSize="10" fill="#8FA79C" fontFamily="monospace">
                  {n.label}
                </text>
              </Link>
            </g>
          );
        })}
        <text x={C} y={C + 4} textAnchor="middle" fontSize="11" fill="#4CE0A0" fontFamily="monospace">
          CarbonX
        </text>
      </svg>
    </div>
  );
}
