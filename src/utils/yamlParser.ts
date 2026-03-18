import { parse as parseYaml } from "yaml";
import * as fs from "fs";
import type {
  AgentDefinition,
  WorkflowDefinition,
  AnyDefinition,
  ProviderName,
  ContextKey,
} from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PROVIDERS: ProviderName[] = ["claude", "codex", "gemini"];
const VALID_CONTEXT_KEYS: ContextKey[] = [
  "selectedCode",
  "filePath",
  "workspacePath",
  "gitDiff",
  "fileContent",
  "codebase",
];

function isProviderName(value: unknown): value is ProviderName {
  return typeof value === "string" && VALID_PROVIDERS.includes(value as ProviderName);
}

function isContextKey(value: unknown): value is ContextKey {
  return typeof value === "string" && VALID_CONTEXT_KEYS.includes(value as ContextKey);
}

// ─── Agent Parser ─────────────────────────────────────────────────────────────

function parseAgentYaml(raw: Record<string, unknown>, sourcePath: string): AgentDefinition {
  const name = raw["name"];
  if (typeof name !== "string" || !name.trim()) {
    throw new Error(`Agent at "${sourcePath}" is missing a valid "name" field.`);
  }

  const provider = raw["provider"];
  if (!isProviderName(provider)) {
    throw new Error(
      `Agent "${name}" has invalid provider "${String(provider)}". ` +
        `Must be one of: ${VALID_PROVIDERS.join(", ")}.`
    );
  }

  const prompt = raw["prompt"];
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error(`Agent "${name}" is missing a valid "prompt" field.`);
  }

  const contextRaw = raw["context"];
  const context: ContextKey[] = [];
  if (Array.isArray(contextRaw)) {
    for (const key of contextRaw) {
      if (!isContextKey(key)) {
        throw new Error(
          `Agent "${name}" has unknown context key "${String(key)}". ` +
            `Must be one of: ${VALID_CONTEXT_KEYS.join(", ")}.`
        );
      }
      context.push(key);
    }
  }

  const model = typeof raw["model"] === "string" ? raw["model"] : undefined;
  const description = typeof raw["description"] === "string" ? raw["description"] : undefined;

  return { name, description, provider, model, context, prompt, sourcePath };
}

// ─── Workflow Parser ──────────────────────────────────────────────────────────

function parseWorkflowYaml(
  raw: Record<string, unknown>,
  sourcePath: string
): WorkflowDefinition {
  const agent = raw["agent"];
  if (typeof agent !== "string" || !agent.trim()) {
    throw new Error(`Workflow at "${sourcePath}" is missing a valid "agent" field.`);
  }

  const stepsRaw = raw["steps"];
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    throw new Error(`Workflow "${agent}" must have at least one step.`);
  }

  const steps: { run: string }[] = [];
  for (const step of stepsRaw) {
    if (typeof step !== "object" || step === null || typeof step["run"] !== "string") {
      throw new Error(
        `Workflow "${agent}" has an invalid step. Each step must have a "run" field.`
      );
    }
    steps.push({ run: step["run"] as string });
  }

  const description = typeof raw["description"] === "string" ? raw["description"] : undefined;

  return { agent, description, steps, sourcePath };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a YAML file at the given path.
 * Returns a tagged `AnyDefinition` union discriminated on `kind`.
 */
export function parseDefinitionFile(filePath: string): AnyDefinition {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`Cannot read file "${filePath}": ${String(err)}`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    throw new Error(`YAML parse error in "${filePath}": ${String(err)}`);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`"${filePath}" does not contain a valid YAML object.`);
  }

  const obj = raw as Record<string, unknown>;

  // Distinguish agent vs workflow by presence of required keys
  if ("steps" in obj && "agent" in obj) {
    return { kind: "workflow", ...parseWorkflowYaml(obj, filePath) };
  }

  return { kind: "agent", ...parseAgentYaml(obj, filePath) };
}
