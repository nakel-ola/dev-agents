import * as vscode from "vscode";
import { AgentLoader } from "../agentEngine/agentLoader.js";
import { AgentRunner } from "../agentEngine/agentRunner.js";
import { WorkflowRunner } from "../agentEngine/workflowRunner.js";
import type { RunResult } from "../types.js";

// ─── Run Agent Command ────────────────────────────────────────────────────────

/**
 * `devagents.runAgent`
 *
 * Prompts the user to select an agent or workflow from the loaded list and
 * runs it against the current editor context.
 *
 * Accepts an optional `agentName` argument so other commands and the sidebar
 * can trigger a specific agent without re-prompting.
 */
export async function runAgentCommand(
  outputChannel: vscode.OutputChannel,
  agentName?: string
): Promise<RunResult | undefined> {
  const loader = new AgentLoader(outputChannel);
  const definitions = loader.loadAll();

  if (definitions.length === 0) {
    const action = await vscode.window.showWarningMessage(
      "No agents found. Create a `.agents/` folder with YAML agent files first.",
      "Create Agent"
    );
    if (action === "Create Agent") {
      await vscode.commands.executeCommand("devagents.createAgent");
    }
    return undefined;
  }

  let selectedName = agentName;

  if (!selectedName) {
    const items: vscode.QuickPickItem[] = definitions.map((d) => ({
      label: d.kind === "agent" ? d.name : d.agent,
      description: d.kind === "workflow" ? "workflow" : `${d.provider}${d.model ? ` • ${d.model}` : ""}`,
      detail: d.description,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      title: "DevAgents: Select Agent or Workflow",
      placeHolder: "Type to filter agents…",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!picked) {
      return undefined;
    }
    selectedName = picked.label;
  }

  // Determine whether it's an agent or workflow
  const def = definitions.find((d) =>
    d.kind === "agent" ? d.name === selectedName : d.agent === selectedName
  );

  if (!def) {
    vscode.window.showErrorMessage(`DevAgents: Agent "${selectedName}" not found.`);
    return undefined;
  }

  const autoOpen = vscode.workspace
    .getConfiguration("devagents")
    .get<boolean>("autoOpenOutput", true);
  if (autoOpen) {
    outputChannel.show(true);
  }

  try {
    let result: RunResult;
    if (def.kind === "workflow") {
      const runner = new WorkflowRunner(outputChannel);
      result = await runner.run(def);
    } else {
      const runner = new AgentRunner(outputChannel);
      result = await runner.run(def);
    }

    // Only open a result document when there is captured output (non-terminal mode).
    if (result.output) {
      await showResultDocument(result);
    }
    return result;
  } catch (err) {
    vscode.window.showErrorMessage(`DevAgents: ${String(err)}`);
    return undefined;
  }
}

// ─── Result Document ──────────────────────────────────────────────────────────

async function showResultDocument(result: RunResult): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: formatResult(result),
  });
  await vscode.window.showTextDocument(document, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
    preview: true,
  });
}

function formatResult(result: RunResult): string {
  const header = [
    `# DevAgents — ${result.name}`,
    "",
    `> **Kind:** ${result.kind}${result.provider ? `  ·  **Provider:** ${result.provider}` : ""}${result.model ? `  ·  **Model:** ${result.model}` : ""}  ·  **Duration:** ${result.durationMs}ms`,
    "",
    "---",
    "",
  ].join("\n");

  if (result.kind === "workflow" && result.steps) {
    const stepsSummary = result.steps
      .map((s, i) => {
        const status = s.error ? `⚠ failed: ${s.error}` : `✔ ${s.durationMs}ms`;
        return `- Step ${i + 1} \`${s.agent}\`: ${status}`;
      })
      .join("\n");
    return header + `## Steps\n\n${stepsSummary}\n\n---\n\n## Output\n\n${result.output}\n`;
  }

  return header + result.output + "\n";
}
