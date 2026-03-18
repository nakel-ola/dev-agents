import * as vscode from "vscode";
import { runInTerminal } from "../utils/terminalRunner.js";
import type { AIProvider, AgentContext, ProviderName } from "../types.js";

export class ClaudeProvider implements AIProvider {
  readonly name: ProviderName = "claude";

  async run(prompt: string, _context: AgentContext, model?: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("devagents.providers.claude");
    const command = cfg.get<string>("command", "claude");

    const extraArgs: string[] = [];
    if (model) {
      extraArgs.push("--model", model);
    }

    runInTerminal(command, extraArgs, prompt, "DevAgents — claude");

    // Terminal is fire-and-forget; output is shown interactively.
    return "";
  }
}
