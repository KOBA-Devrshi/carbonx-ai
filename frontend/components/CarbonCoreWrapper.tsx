"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import CarbonCore2D from "./CarbonCore2D";

const CarbonCore3D = dynamic(() => import("./CarbonCore"), {
  ssr: false,
  loading: () => <div className="w-full h-[420px] md:h-[480px] flex items-center justify-center text-textFaint text-sm font-mono">Loading Carbon Intelligence Core…</div>,
});

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export default function CarbonCoreWrapper() {
  const [mode, setMode] = useState<"loading" | "3d" | "2d">("loading");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMode(!reducedMotion && hasWebGL() ? "3d" : "2d");
  }, []);

  if (mode === "loading") return <div className="w-full h-[420px] md:h-[480px]" />;
  return mode === "3d" ? <CarbonCore3D /> : <CarbonCore2D />;
}
