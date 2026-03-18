

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseDefinitionFile } from "../utils/yamlParser.js";
import type { AnyDefinition, AgentDefinition, WorkflowDefinition } from "../types.js";

// ─── Agent Loader ─────────────────────────────────────────────────────────────

export class AgentLoader {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Resolve the agents folder from VS Code configuration.
   * Returns undefined if no workspace is open.
   */
  getAgentsFolder(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    const configuredFolder = vscode.workspace
      .getConfiguration("devagents")
      .get<string>("agentsFolder", ".agents");
    return path.join(folder.uri.fsPath, configuredFolder);
  }

  /**
   * Load all agent and workflow definitions from the workspace agents folder.
   * Silently skips files that cannot be parsed, logging errors to the output channel.
   */
  loadAll(): AnyDefinition[] {
    const agentsDir = this.getAgentsFolder();
    if (!agentsDir) {
      return [];
    }

    if (!fs.existsSync(agentsDir)) {
      return [];
    }

    let files: string[];
    try {
      files = fs.readdirSync(agentsDir);
    } catch (err) {
      this.outputChannel.appendLine(`[AgentLoader] Cannot read agents folder: ${String(err)}`);
      return [];
    }

    const definitions: AnyDefinition[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
        continue;
      }
      const filePath = path.join(agentsDir, file);
      try {
        const def = parseDefinitionFile(filePath);
        definitions.push(def);
      } catch (err) {
        skipped.push(`"${file}": ${String(err)}`);
      }
    }

    const names = definitions.map((d) => (d.kind === "agent" ? d.name : d.agent));
    this.outputChannel.appendLine(
      `[AgentLoader] Loaded ${definitions.length} definition(s): ${names.join(", ") || "(none)"}`
    );
    for (const s of skipped) {
      this.outputChannel.appendLine(`[AgentLoader] Skipped ${s}`);
    }

    return definitions;
  }

  /**
   * Load a single agent by name.
   * Returns undefined if not found.
   */
  loadAgent(name: string): AgentDefinition | undefined {
    const all = this.loadAll();
    const match = all.find(
      (d): d is { kind: "agent" } & AgentDefinition =>
        d.kind === "agent" && d.name === name
    );
    return match;
  }

  /**
   * Load a single workflow by agent field name.
   * Returns undefined if not found.
   */
  loadWorkflow(name: string): WorkflowDefinition | undefined {
    const all = this.loadAll();
    const match = all.find(
      (d): d is { kind: "workflow" } & WorkflowDefinition =>
        d.kind === "workflow" && d.agent === name
    );
    return match;
  }

  /**
   * Ensure the agents folder exists, creating it if necessary.
   * Returns the absolute path to the folder.
   */
  ensureAgentsFolder(): string {
    const agentsDir = this.getAgentsFolder();
    if (!agentsDir) {
      throw new Error("No workspace folder is open.");
    }
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
      this.outputChannel.appendLine(`[AgentLoader] Created agents folder at: ${agentsDir}`);
    }
    return agentsDir;
  }
}
