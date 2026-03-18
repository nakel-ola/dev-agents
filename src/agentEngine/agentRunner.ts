import * as vscode from "vscode";
import { getProvider } from "../providers/aiProvider.js";
import { collectContext, renderPrompt } from "../context/contextCollector.js";
import type { AgentDefinition, AgentContext, RunResult } from "../types.js";

// ─── Agent Runner ─────────────────────────────────────────────────────────────

export class AgentRunner {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Run a single agent definition.
   * @param agent   The loaded agent definition
   * @param baseCtx Optional pre-collected context (will be merged/overridden by agent's declared keys)
   */
  async run(agent: AgentDefinition, baseCtx?: AgentContext): Promise<RunResult> {
    const startMs = Date.now();

    this.outputChannel.appendLine(
      `\n[AgentRunner] ▶ Running agent: "${agent.name}" (provider: ${agent.provider}${agent.model ? `, model: ${agent.model}` : ""})`
    );

    // Collect context for the keys the agent declared
    const collectedCtx = await collectContext(agent.context ?? []);
    const ctx: AgentContext = { ...baseCtx, ...collectedCtx };

    // Warn (don't throw) when selectedCode is declared but nothing is selected.
    // The {{selectedCode}} placeholder will simply be left empty in the prompt.
    if ((agent.context ?? []).includes("selectedCode") && !ctx.selectedCode) {
      this.outputChannel.appendLine(
        `[AgentRunner] ⚠ No code selected — {{selectedCode}} will be empty.`
      );
    }

    // Render prompt with context substitution
    const renderedPrompt = renderPrompt(agent.prompt, ctx);

    this.outputChannel.appendLine(`[AgentRunner] Rendered prompt (${renderedPrompt.length} chars)`);
    if (vscode.workspace.getConfiguration("devagents").get<boolean>("outputVerbose", false)) {
      this.outputChannel.appendLine("--- prompt start ---");
      this.outputChannel.appendLine(renderedPrompt);
      this.outputChannel.appendLine("--- prompt end ---");
    }

    // Resolve provider and execute
    const provider = getProvider(agent.provider);
    let output: string;
    try {
      output = await provider.run(renderedPrompt, ctx, agent.model);
    } catch (err) {
      const msg = `Agent "${agent.name}" failed: ${String(err)}`;
      this.outputChannel.appendLine(`[AgentRunner] ✖ ${msg}`);
      throw new Error(msg);
    }

    const durationMs = Date.now() - startMs;
    if (output) {
      this.outputChannel.appendLine(
        `[AgentRunner] ✔ Completed in ${durationMs}ms (${output.length} chars)`
      );
      this.outputChannel.appendLine(output);
    } else {
      this.outputChannel.appendLine(
        `[AgentRunner] ✔ Launched in ${durationMs}ms — output shown in terminal`
      );
    }

    return {
      name: agent.name,
      kind: "agent",
      provider: agent.provider,
      model: agent.model,
      output,
      durationMs,
    };
  }
}
