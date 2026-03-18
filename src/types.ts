// ─── Agent & Workflow Type Definitions ───────────────────────────────────────

export type ProviderName = "claude" | "codex" | "gemini";

export type ContextKey =
  | "selectedCode"
  | "filePath"
  | "workspacePath"
  | "gitDiff"
  | "fileContent"
  | "codebase";

/** A single agent definition loaded from a .agent.yaml file */
export interface AgentDefinition {
  /** Unique name of the agent */
  name: string;
  /** Human-readable description */
  description?: string;
  /** AI provider to use */
  provider: ProviderName;
  /** Model override forwarded to the provider CLI */
  model?: string;
  /** Context keys that are injected into the prompt template */
  context?: ContextKey[];
  /** Prompt template. Supports {{selectedCode}}, {{filePath}}, etc. */
  prompt: string;
  /** Absolute path to the source YAML file */
  sourcePath: string;
}

/** A workflow step that runs a named agent */
export interface WorkflowStep {
  run: string;
}

/** A workflow definition loaded from a .workflow.yaml file */
export interface WorkflowDefinition {
  /** Workflow identifier (used as the agent name in UI) */
  agent: string;
  description?: string;
  steps: WorkflowStep[];
  /** Absolute path to the source YAML file */
  sourcePath: string;
}

/** Union of loadable definitions */
export type AnyDefinition =
  | ({ kind: "agent" } & AgentDefinition)
  | ({ kind: "workflow" } & WorkflowDefinition);

// ─── Context ─────────────────────────────────────────────────────────────────

export interface AgentContext {
  selectedCode?: string;
  filePath?: string;
  workspacePath?: string;
  gitDiff?: string;
  fileContent?: string;
  /** Full codebase snapshot — all readable text files concatenated with headers */
  codebase?: string;
}

// ─── Execution Results ────────────────────────────────────────────────────────

export interface RunResult {
  name: string;
  kind: "agent" | "workflow";
  provider?: ProviderName;
  model?: string;
  output: string;
  durationMs: number;
  /** Steps results for workflows */
  steps?: StepResult[];
}

export interface StepResult {
  agent: string;
  output: string;
  durationMs: number;
  error?: string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface AIProvider {
  /** Provider identifier */
  readonly name: ProviderName;
  /** Execute a rendered prompt and return the raw output string */
  run(prompt: string, context: AgentContext, model?: string): Promise<string>;
}

// ─── Sidebar Webview Messages ─────────────────────────────────────────────────

export interface WebviewStateMessage {
  type: "state";
  payload: {
    agents: SidebarAgent[];
    lastRun: RunResult | null;
  };
}

export interface WebviewExecutionMessage {
  type: "execution";
  payload: RunResult;
}

export type WebviewMessage = WebviewStateMessage | WebviewExecutionMessage;

export interface SidebarAgent {
  name: string;
  kind: "agent" | "workflow";
  description?: string;
  provider?: ProviderName;
  model?: string;
  steps: string[];
  source: string;
}
