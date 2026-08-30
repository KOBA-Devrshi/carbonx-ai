"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/", "Home"],
  ["/dashboard", "Dashboard"],
  ["/marketplace", "Marketplace"],
  ["/matching", "Buyer Match"],
  ["/ingestion", "Data Ingestion"],
  ["/admin", "Admin"],
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto px-7 py-3.5 flex items-center gap-7">
        <Link href="/" className="flex items-center gap-2.5 font-sans font-bold text-lg">
          <span className="w-6.5 h-6.5 rounded-md bg-gradient-to-br from-accent to-[#1a5c3f] flex items-center justify-center text-[13px] text-[#062015] font-bold w-[26px] h-[26px]">
            Cx
          </span>
          CarbonX AI
        </Link>
        <nav className="flex gap-1 flex-1 flex-wrap">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`text-[13px] font-medium px-3 py-2 rounded-md ${
                pathname === href ? "text-accent bg-accent/10" : "text-textDim hover:text-text hover:bg-surface"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <span className="font-mono text-[10px] tracking-wide px-2.5 py-1 rounded border border-amberDim text-amber bg-amber/5 whitespace-nowrap">
          ● DEMO MODE — SIMULATED
        </span>
      </div>
    </div>
  );
}
