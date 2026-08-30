export type AgentMode = "voice" | "chat";
export type OrbState = "idle" | "listening" | "transcribing" | "thinking" | "executing" | "speaking" | "error" | "success";

export type StepStatus = "pending" | "done" | "error";
export type ToolStep = { label: string; status: StepStatus };

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  text: string;          // full detail text shown in the chat
  spoken?: string;        // shorter version spoken aloud (falls back to text)
  steps?: ToolStep[];     // tool execution timeline, if any
  actions?: { label: string; href: string }[];
  ts: number;
};

export type PendingConfirmation = {
  action: "flagIntegrity" | "clearIntegrity" | "retire" | "purchase";
  creditId: string;
  detail: string;
} | null;

export type AgentContextState = {
  selectedCreditId: string | null;
  selectedCreditName: string | null;
  lastIntent: string | null;
  lastAuditFindings: { finding_type: string; severity: string; description: string }[] | null;
};
