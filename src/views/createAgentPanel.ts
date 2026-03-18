import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AgentLoader } from "../agentEngine/agentLoader.js";

// ─── Message types ────────────────────────────────────────────────────────────

interface SubmitAgentMsg {
  type: "submit";
  kind: "agent";
  name: string;
  description: string;
  provider: string;
  model: string;
  context: string[];
  prompt: string;
}

interface SubmitWorkflowMsg {
  type: "submit";
  kind: "workflow";
  name: string;
  description: string;
  steps: string[];
}

type PanelMsg = SubmitAgentMsg | SubmitWorkflowMsg | { type: "cancel" };

/** Shape of the pre-fill data injected when opening the panel in edit mode. */
export interface EditDef {
  kind: "agent" | "workflow";
  sourcePath: string;
  // agent fields
  name?: string;
  description?: string;
  provider?: string;
  model?: string;
  context?: string[];
  prompt?: string;
  // workflow fields
  agent?: string;
  steps?: string[];
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export class CreateAgentPanel {
  private static instance: CreateAgentPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly outputChannel: vscode.OutputChannel;

  /** Open a blank "create" form. */
  static open(outputChannel: vscode.OutputChannel, extensionUri: vscode.Uri): void {
    if (CreateAgentPanel.instance) {
      CreateAgentPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    new CreateAgentPanel(outputChannel, extensionUri, undefined);
  }

  /** Open the form pre-filled with an existing agent or workflow definition. */
  static openForEdit(
    outputChannel: vscode.OutputChannel,
    extensionUri: vscode.Uri,
    def: EditDef
  ): void {
    if (CreateAgentPanel.instance) {
      CreateAgentPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    new CreateAgentPanel(outputChannel, extensionUri, def);
  }

  private constructor(
    outputChannel: vscode.OutputChannel,
    extensionUri: vscode.Uri,
    editDef: EditDef | undefined
  ) {
    this.outputChannel = outputChannel;

    const isEdit = editDef !== undefined;

    const loader = new AgentLoader(outputChannel);
    const agentNames = loader
      .loadAll()
      .filter((d) => d.kind === "agent")
      .map((d) => d.name);

    const title = isEdit
      ? `DevAgents — Edit ${editDef!.kind === "workflow" ? editDef!.agent ?? "Workflow" : editDef!.name ?? "Agent"}`
      : "DevAgents — New Agent";

    this.panel = vscode.window.createWebviewPanel(
      "devagents.createAgent",
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "media", "devagents.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "media", "devagents-dark.svg"),
    };

    this.panel.webview.html = buildHtml(this.panel.webview, extensionUri, agentNames, editDef);

    this.panel.webview.onDidReceiveMessage(async (msg: PanelMsg) => {
      if (msg.type === "cancel") {
        this.panel.dispose();
      } else if (msg.type === "submit") {
        const saved = await this.save(msg, editDef);
        if (saved) {
          this.panel.dispose();
        }
      }
    });

    this.panel.onDidDispose(() => {
      CreateAgentPanel.instance = undefined;
    });

    CreateAgentPanel.instance = this;
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  private async save(
    msg: SubmitAgentMsg | SubmitWorkflowMsg,
    editDef: EditDef | undefined
  ): Promise<boolean> {
    const isEdit = editDef !== undefined;

    const loader = new AgentLoader(this.outputChannel);
    let agentsDir: string;
    try {
      agentsDir = loader.ensureAgentsFolder();
    } catch (err) {
      vscode.window.showErrorMessage(`DevAgents: ${String(err)}`);
      return false;
    }

    const suffix = msg.kind === "workflow" ? ".workflow.yaml" : ".agent.yaml";
    const newFileName = `${msg.name.trim()}${suffix}`;
    const newFilePath = path.join(agentsDir, newFileName);

    const oldFilePath = editDef?.sourcePath;
    const nameChanged = isEdit && oldFilePath !== newFilePath;

    if (!isEdit && fs.existsSync(newFilePath)) {
      const choice = await vscode.window.showWarningMessage(
        `"${newFileName}" already exists. Overwrite?`,
        { modal: true },
        "Overwrite"
      );
      if (choice !== "Overwrite") {
        return false;
      }
    }

    const content =
      msg.kind === "workflow" ? buildWorkflowYaml(msg) : buildAgentYaml(msg);

    try {
      fs.writeFileSync(newFilePath, content, "utf8");
    } catch (err) {
      vscode.window.showErrorMessage(`DevAgents: Could not write file: ${String(err)}`);
      return false;
    }

    if (nameChanged && oldFilePath && fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath);
      } catch {
        // Non-fatal — old file stays but new one is written.
      }
    }

    const verb = isEdit ? "Updated" : "Created";
    this.outputChannel.appendLine(`[EditAgent] ${verb} ${msg.kind}: ${newFilePath}`);

    vscode.window.showInformationMessage(
      `DevAgents: ${verb} "${newFileName}"${nameChanged ? ` (renamed from "${path.basename(oldFilePath!)}")` : ""}`
    );
    return true;
  }
}

// ─── YAML builders ────────────────────────────────────────────────────────────

function buildAgentYaml(msg: SubmitAgentMsg): string {
  const desc = msg.description ? `description: ${msg.description}\n` : "";
  const model = msg.model ? `model: ${msg.model}\n` : "";
  const ctx = msg.context.length
    ? "context:\n" + msg.context.map((k) => `  - ${k}`).join("\n") + "\n"
    : "";
  const promptIndented = msg.prompt
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
  return `name: ${msg.name}\n${desc}provider: ${msg.provider}\n${model}${ctx}prompt: |\n${promptIndented}\n`;
}

function buildWorkflowYaml(msg: SubmitWorkflowMsg): string {
  const desc = msg.description ? `description: ${msg.description}\n` : "";
  const steps = msg.steps.length
    ? "steps:\n" + msg.steps.map((s) => `  - run: ${s}`).join("\n") + "\n"
    : "steps: []\n";
  return `agent: ${msg.name}\n${desc}${steps}`;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function buildHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  agentNames: string[],
  prefill?: EditDef
): string {
  const nonce = getNonce();
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "createAgent.css"));
  const twCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "createAgent.js"));
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
  ].join("; ");

  const agentNamesJson = JSON.stringify(agentNames);
  const prefillJson = prefill ? JSON.stringify(prefill) : "null";
  const pageTitle = prefill ? "Edit Agent" : "New Agent";

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>DevAgents — ${pageTitle}</title>
  <link rel="stylesheet" href="${twCssUri}"/>
  <link rel="stylesheet" href="${cssUri}"/>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">const AGENT_NAMES=${agentNamesJson};const PREFILL=${prefillJson};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
