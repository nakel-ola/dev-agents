import * as vscode from "vscode";
import { runInTerminal } from "../utils/terminalRunner.js";
import type { AIProvider, AgentContext, ProviderName } from "../types.js";

export class CodexProvider implements AIProvider {
  readonly name: ProviderName = "codex";

  async run(prompt: string, _context: AgentContext, model?: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("devagents.providers.codex");
    const command = cfg.get<string>("command", "codex");

    const extraArgs: string[] = [];
    if (model) {
      extraArgs.push("--model", model);
    }

    runInTerminal(command, extraArgs, prompt, "DevAgents — codex");

    return "";
  }
}
