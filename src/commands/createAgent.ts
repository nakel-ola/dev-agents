import * as vscode from "vscode";
import { CreateAgentPanel } from "../views/createAgentPanel.js";

/**
 * `devagents.createAgent`
 *
 * Opens the Create Agent webview panel — a single-view form with live YAML preview.
 */
export async function createAgentCommand(
  outputChannel: vscode.OutputChannel,
  extensionUri: vscode.Uri
): Promise<void> {
  CreateAgentPanel.open(outputChannel, extensionUri);
}
