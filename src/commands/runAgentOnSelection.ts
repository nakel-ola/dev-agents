import * as vscode from "vscode";
import { AgentLoader } from "../agentEngine/agentLoader.js";
import { AgentRunner } from "../agentEngine/agentRunner.js";
import type { RunResult, AgentContext } from "../types.js";

// ─── Run Agent On Selection Command ──────────────────────────────────────────

/**
 * `devagents.runAgentOnSelection`
 *
 * Validates that the user has text selected, then prompts for an agent to run.
 * Only lists agents that declare `selectedCode` in their context (or all agents
 * when none declare it, as a fallback).
 */
export async function runAgentOnSelectionCommand(
  outputChannel: vscode.OutputChannel
): Promise<RunResult | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage(
      "DevAgents: Please select some code before running an agent on selection."
    );
    return undefined;
  }

  const selectedCode = editor.document.getText(editor.selection);
  const filePath = editor.document.uri.fsPath;

  const loader = new AgentLoader(outputChannel);
  const allDefs = loader.loadAll();
  const agents = allDefs.filter((d) => d.kind === "agent");

  if (agents.length === 0) {
    const action = await vscode.window.showWarningMessage(
      "No agents found. Create a `.agents/` folder with YAML agent files first.",
      "Create Agent"
    );
    if (action === "Create Agent") {
      await vscode.commands.executeCommand("devagents.createAgent");
    }
    return undefined;
  }

  // Prefer agents that explicitly require selectedCode; fall back to all agents
  const selectionAgents = agents.filter(
    (d) => d.kind === "agent" && d.context?.includes("selectedCode")
  );
  const listItems = (selectionAgents.length > 0 ? selectionAgents : agents).map((d) => ({
    label: d.name,
    description: `${d.provider}${d.model ? ` • ${d.model}` : ""}`,
    detail: d.description,
  }));

  const picked = await vscode.window.showQuickPick(listItems, {
    title: "DevAgents: Run Agent on Selection",
    placeHolder: "Select an agent to run on selected code…",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!picked) {
    return undefined;
  }

  const def = agents.find((d) => d.name === picked.label);
  if (!def || def.kind !== "agent") {
    return undefined;
  }

  const autoOpen = vscode.workspace
    .getConfiguration("devagents")
    .get<boolean>("autoOpenOutput", true);
  if (autoOpen) {
    outputChannel.show(true);
  }

  const baseCtx: AgentContext = { selectedCode, filePath };

  try {
    const runner = new AgentRunner(outputChannel);
    const result = await runner.run(def, baseCtx);

    // Open result beside the editor
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: buildMarkdown(result.name, selectedCode, result.output, result.durationMs),
    });
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
      preview: true,
    });

    return result;
  } catch (err) {
    vscode.window.showErrorMessage(`DevAgents: ${String(err)}`);
    return undefined;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMarkdown(
  agentName: string,
  selection: string,
  output: string,
  durationMs: number
): string {
  const truncated =
    selection.length > 500 ? selection.slice(0, 500) + "\n…(truncated)" : selection;

  return [
    `# DevAgents — ${agentName}`,
    "",
    `> Duration: ${durationMs}ms`,
    "",
    "## Selected Code",
    "",
    "```",
    truncated,
    "```",
    "",
    "---",
    "",
    "## Output",
    "",
    output,
    "",
  ].join("\n");
}
