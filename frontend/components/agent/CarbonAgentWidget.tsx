"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgent } from "@/context/AgentContext";

const ORB_COLOR: Record<string, string> = {
  idle: "#4CE0A0", listening: "#2DD4BF", transcribing: "#2DD4BF", thinking: "#F2C14E",
  executing: "#F2C14E", speaking: "#4CE0A0", error: "#FF6B6B", success: "#4CE0A0",
};

function Orb({ size = 40 }: { size?: number }) {
  const { orbState } = useAgent();
  const color = ORB_COLOR[orbState] || "#4CE0A0";
  const pulsing = orbState === "listening" || orbState === "speaking" || orbState === "thinking" || orbState === "executing";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: color, opacity: 0.25 }}
        animate={pulsing ? { scale: [1, 1.4, 1], opacity: [0.25, 0.05, 0.25] } : { scale: 1 }}
        transition={{ repeat: pulsing ? Infinity : 0, duration: orbState === "listening" ? 0.8 : 1.6 }}
      />
      <motion.div
        className="rounded-full"
        style={{ width: size * 0.55, height: size * 0.55, background: color, boxShadow: `0 0 ${size * 0.5}px ${color}` }}
        animate={orbState === "thinking" || orbState === "executing" ? { rotate: 360 } : {}}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      />
    </div>
  );
}

function Waveform() {
  return (
    <div className="flex items-end gap-1 h-6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i}
          className="w-1 bg-accent rounded-full"
          animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.08, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: { label: string; status: string }[] }) {
  return (
    <div className="flex flex-col gap-1 mt-2">
      {steps.map((s, i) => (
        <div key={i} className={`text-[11.5px] flex items-center gap-1.5 ${s.status === "done" ? "text-accent" : s.status === "error" ? "text-danger" : "text-textFaint"}`}>
          <span>{s.status === "done" ? "✓" : s.status === "error" ? "✕" : "●"}</span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { speechSettings, setSpeechSettings, voices, micSupported, synthSupported } = useAgent();
  return (
    <div className="absolute bottom-full right-0 mb-2 w-72 card bg-surface2 z-10">
      <div className="flex justify-between items-center mb-3">
        <span className="font-sans font-semibold text-[13px]">Voice Settings</span>
        <button onClick={onClose} className="text-textFaint hover:text-text text-sm">✕</button>
      </div>
      <div className="field">
        <label>Voice</label>
        <select
          value={speechSettings.voiceURI || ""}
          onChange={(e) => setSpeechSettings({ voiceURI: e.target.value || null })}
          disabled={!synthSupported}
        >
          <option value="">Browser Default</option>
          {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Speech Speed</label>
        <select value={speechSettings.rate} onChange={(e) => setSpeechSettings({ rate: parseFloat(e.target.value) })} disabled={!synthSupported}>
          <option value={0.8}>0.8x</option>
          <option value={1.0}>1.0x</option>
          <option value={1.2}>1.2x</option>
        </select>
      </div>
      <div className="flex justify-between items-center text-[12.5px] py-1.5">
        <span>Auto Speak</span>
        <button
          className={`btn-sm px-2.5 py-1 rounded-md font-mono text-[11px] ${speechSettings.autoSpeak ? "bg-accent/15 text-accent" : "bg-surface text-textFaint"}`}
          onClick={() => setSpeechSettings({ autoSpeak: !speechSettings.autoSpeak })}
        >
          {speechSettings.autoSpeak ? "ON" : "OFF"}
        </button>
      </div>
      <div className="flex justify-between items-center text-[12.5px] py-1.5">
        <span>Voice Output</span>
        <button
          className={`btn-sm px-2.5 py-1 rounded-md font-mono text-[11px] ${speechSettings.voiceOn ? "bg-accent/15 text-accent" : "bg-surface text-textFaint"}`}
          onClick={() => setSpeechSettings({ voiceOn: !speechSettings.voiceOn })}
        >
          {speechSettings.voiceOn ? "ON" : "OFF"}
        </button>
      </div>
      <div className="text-[11px] text-textFaint mt-2 pt-2 border-t border-border">
        Microphone: {micSupported ? "Available" : "Not available in this browser"}
      </div>
    </div>
  );
}

export default function CarbonAgentWidget() {
  const agent = useAgent();
  const { open, setOpen, mode, setMode, messages, sendText, orbState, micSupported, micState, toggleListening, stopSpeaking, micError } = agent;
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function handleSend() {
    if (!input.trim()) return;
    sendText(input);
    setInput("");
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="glass rounded-2xl w-[380px] max-w-[92vw] h-[560px] max-h-[75vh] flex flex-col mb-4 overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Orb size={30} />
                <div>
                  <div className="font-sans font-semibold text-[13.5px] leading-none">CarbonX Intelligence</div>
                  <div className="text-[10.5px] text-accent font-mono mt-1">● ONLINE</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-textFaint hover:text-text">✕</button>
            </div>

            {/* Mode switcher */}
            <div className="flex gap-1 px-3 pt-3">
              <button
                onClick={() => setMode("voice")}
                className={`flex-1 text-[12px] font-medium py-2 rounded-lg border ${mode === "voice" ? "border-accentDim bg-accent/10 text-accent" : "border-border text-textDim"}`}
              >
                🎙 VOICE
              </button>
              <button
                onClick={() => setMode("chat")}
                className={`flex-1 text-[12px] font-medium py-2 rounded-lg border ${mode === "chat" ? "border-accentDim bg-accent/10 text-accent" : "border-border text-textDim"}`}
              >
                💬 CHAT
              </button>
            </div>

            {micError && (
              <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg bg-danger/10 border border-dangerDim text-[11px] text-danger">
                {micError}
              </div>
            )}

            {/* Voice listening state */}
            {mode === "voice" && micState === "listening" && (
              <div className="mx-3 mt-2 px-3 py-3 rounded-lg bg-surface2 border border-accentDim flex flex-col items-center gap-2">
                <span className="font-mono text-[11px] text-accent">● LISTENING</span>
                <Waveform />
              </div>
            )}

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2.5 rounded-xl text-[12.5px] leading-relaxed ${
                    m.role === "user" ? "bg-accent/10 border border-accentDim" : "bg-surface2 border border-border"
                  }`}>
                    {m.role === "agent" && <div className="flex items-center gap-1.5 mb-1"><Orb size={14} /><span className="font-mono text-[9.5px] uppercase text-textFaint">CarbonX</span></div>}
                    <div>{m.text}</div>
                    {m.steps && <StepList steps={m.steps} />}
                    {m.actions && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {m.actions.map((a, i) => (
                          <a key={i} href={a.href} className="btn btn-ghost btn-sm">{a.label}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border relative">
              {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="w-9 h-9 flex-shrink-0 rounded-lg border border-border text-textDim hover:text-text flex items-center justify-center text-sm"
                  title="Voice Settings"
                >
                  ⚙
                </button>
                <button
                  onClick={orbState === "speaking" ? stopSpeaking : toggleListening}
                  disabled={!micSupported && orbState !== "speaking"}
                  className={`w-9 h-9 flex-shrink-0 rounded-lg border flex items-center justify-center text-sm ${
                    micState === "listening" ? "border-accent bg-accent/15 text-accent" : "border-border text-textDim hover:text-text"
                  } ${!micSupported ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={orbState === "speaking" ? "Stop speaking" : "Voice input"}
                >
                  {orbState === "speaking" ? "🔇" : "🎙"}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask CarbonX anything…"
                  rows={1}
                  className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accentDim resize-none"
                />
                <button onClick={handleSend} className="w-9 h-9 flex-shrink-0 rounded-lg bg-accent text-[#062015] flex items-center justify-center font-bold">➤</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-16 h-16 rounded-full glass glow-accent flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Orb size={44} />
        </button>
      )}
    </div>
  );
}
