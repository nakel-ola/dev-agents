import * as vscode from "vscode";
import { runInTerminal } from "../utils/terminalRunner.js";
import type { AIProvider, AgentContext, ProviderName } from "../types.js";

export class GeminiProvider implements AIProvider {
  readonly name: ProviderName = "gemini";

  async run(prompt: string, _context: AgentContext, model?: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("devagents.providers.gemini");
    const command = cfg.get<string>("command", "gemini");

    const extraArgs: string[] = [];
    if (model) {
      extraArgs.push("--model", model);
    }

    runInTerminal(command, extraArgs, prompt, "DevAgents — gemini");

    return "";
  }
}
