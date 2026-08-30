import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { AgentProvider } from "@/context/AgentContext";
import CarbonAgentWidget from "@/components/agent/CarbonAgentWidget";

export const metadata: Metadata = {
  title: "CarbonX AI — The Trust & Intelligence Layer for Carbon Markets",
  description: "Don't just trade a carbon credit. Challenge it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Optional — loaded at runtime in the browser, not at build time, so it
            never blocks `next build` even without internet access in CI. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-bg text-text min-h-screen">
        <AgentProvider>
          <Nav />
          <main className="max-w-[1280px] mx-auto px-7 pb-24">{children}</main>
          <CarbonAgentWidget />
        </AgentProvider>
      </body>
    </html>
  );
}
