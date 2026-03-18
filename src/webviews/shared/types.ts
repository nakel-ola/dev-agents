export type ProviderName = "claude" | "codex" | "gemini";

export interface SidebarAgent {
  name: string;
  kind: "agent" | "workflow";
  description?: string;
  provider?: ProviderName;
  model?: string;
  steps: string[];
  source: string;
}

export interface RunResult {
  name: string;
  kind: "agent" | "workflow";
  provider?: ProviderName;
  model?: string;
  output: string;
  durationMs: number;
}

export type WebviewMessage =
  | { type: "state"; payload: { agents: SidebarAgent[]; lastRun: RunResult | null } }
  | { type: "execution"; payload: RunResult };

export interface EditDef {
  kind: "agent" | "workflow";
  sourcePath: string;
  name?: string;
  description?: string;
  provider?: string;
  model?: string;
  context?: string[];
  prompt?: string;
  agent?: string;
  steps?: string[];
}
