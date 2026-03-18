import * as vscode from "vscode";
import { AgentLoader } from "./agentLoader.js";
import { AgentRunner } from "./agentRunner.js";
import { collectFullContext } from "../context/contextCollector.js";
import type { WorkflowDefinition, RunResult, StepResult, AgentContext } from "../types.js";

// ─── Workflow Runner ──────────────────────────────────────────────────────────

export class WorkflowRunner {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly agentLoader: AgentLoader;
  private readonly agentRunner: AgentRunner;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.agentLoader = new AgentLoader(outputChannel);
    this.agentRunner = new AgentRunner(outputChannel);
  }

  /**
   * Execute a workflow: run each step in sequence, passing accumulated
   * context (including the previous step's output) to the next step.
   */
  async run(workflow: WorkflowDefinition): Promise<RunResult> {
    const workflowStartMs = Date.now();

    this.outputChannel.appendLine(
      `\n[WorkflowRunner] ▶ Starting workflow: "${workflow.agent}" (${workflow.steps.length} steps)`
    );

    // Collect base context once up-front
    const baseCtx: AgentContext = await collectFullContext();
    const stepResults: StepResult[] = [];

    let accumulatedOutput = "";

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (!step) {
        continue;
      }
      const stepNum = i + 1;

      this.outputChannel.appendLine(
        `\n[WorkflowRunner] Step ${stepNum}/${workflow.steps.length}: running agent "${step.run}"`
      );

      // Load the agent for this step
      const agentDef = this.agentLoader.loadAgent(step.run);
      if (!agentDef) {
        const err = `Workflow step ${stepNum}: agent "${step.run}" not found.`;
        this.outputChannel.appendLine(`[WorkflowRunner] ✖ ${err}`);
        stepResults.push({ agent: step.run, output: "", durationMs: 0, error: err });
        // Continue running remaining steps so user gets partial output
        continue;
      }

      // Inject previous step's output as selectedCode context if available
      const stepCtx: AgentContext = accumulatedOutput
        ? { ...baseCtx, selectedCode: accumulatedOutput }
        : { ...baseCtx };

      const stepStartMs = Date.now();
      try {
        const result = await this.agentRunner.run(agentDef, stepCtx);
        accumulatedOutput = result.output;
        stepResults.push({
          agent: step.run,
          output: result.output,
          durationMs: result.durationMs,
        });
      } catch (err) {
        const errMsg = String(err);
        this.outputChannel.appendLine(`[WorkflowRunner] ✖ Step ${stepNum} failed: ${errMsg}`);
        stepResults.push({
          agent: step.run,
          output: "",
          durationMs: Date.now() - stepStartMs,
          error: errMsg,
        });
      }
    }

    const totalDurationMs = Date.now() - workflowStartMs;
    const successCount = stepResults.filter((s) => !s.error).length;
    this.outputChannel.appendLine(
      `\n[WorkflowRunner] ✔ Workflow "${workflow.agent}" complete — ` +
        `${successCount}/${workflow.steps.length} steps succeeded in ${totalDurationMs}ms`
    );

    // Build combined output from all successful steps
    const combinedOutput = stepResults
      .map((s, idx) => {
        const label = `### Step ${idx + 1}: ${s.agent}`;
        return s.error ? `${label}\n⚠ Error: ${s.error}` : `${label}\n${s.output}`;
      })
      .join("\n\n---\n\n");

    return {
      name: workflow.agent,
      kind: "workflow",
      output: combinedOutput,
      durationMs: totalDurationMs,
      steps: stepResults,
    };
  }
}
