"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/seller", label: "Seller Portal" },
  ];

  return (
    <header className="flex justify-between items-center px-6 py-4 border-b border-border bg-surface">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded bg-accent/20 text-accent font-mono text-xs font-bold">Cx</span>
        <span className="font-sans font-semibold text-lg tracking-tight">CarbonX AI</span>
      </div>

      <nav className="flex items-center gap-6">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-textDim hover:text-text"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <span className="px-2 py-0.5 rounded bg-surface2 border border-border font-mono text-[10.5px] text-textDim uppercase">
          DEMO MODE · SIMULATED
        </span>
      </div>
    </header>
  );
}