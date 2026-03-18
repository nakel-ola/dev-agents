import * as vscode from "vscode";
import { AgentLoader } from "../agentEngine/agentLoader.js";
import { AgentRunner } from "../agentEngine/agentRunner.js";
import { WorkflowRunner } from "../agentEngine/workflowRunner.js";
import type { RunResult, SidebarAgent, WebviewMessage } from "../types.js";

// ─── Agent Sidebar Provider ───────────────────────────────────────────────────

export class AgentSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devagents.sidebar";

  private view?: vscode.WebviewView;
  private lastRun: RunResult | null = null;
  private cachedDefs: import("../types.js").AnyDefinition[] = [];

  private readonly outputChannel: vscode.OutputChannel;
  private readonly extensionUri: vscode.Uri;

  constructor(outputChannel: vscode.OutputChannel, extensionUri: vscode.Uri) {
    this.outputChannel = outputChannel;
    this.extensionUri = extensionUri;
  }

  // ─── Resolve Webview ────────────────────────────────────────────────────────

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };

    webviewView.webview.html = this.buildHtml(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (msg: { type: string; payload?: unknown }) => {
      switch (msg.type) {
        case "ready":
          this.pushState();
          break;

        case "refresh":
          this.pushState();
          break;

        case "runAgent": {
          const payload = msg.payload as { name: string };
          await this.runByName(payload.name);
          break;
        }

        case "editAgent": {
          const payload = msg.payload as { source: string };
          const defToEdit = this.cachedDefs.find((d) => d.sourcePath === payload.source);
          const nameToEdit = defToEdit
            ? defToEdit.kind === "agent"
              ? defToEdit.name
              : defToEdit.agent
            : undefined;
          await vscode.commands.executeCommand("devagents.editAgent", nameToEdit);
          break;
        }

        case "createAgent":
          await vscode.commands.executeCommand("devagents.createAgent");
          this.pushState();
          break;

        default:
          this.outputChannel.appendLine(
            `[Sidebar] Unknown message type: ${String(msg.type)}`
          );
      }
    });

    // Refresh when files in the agents folder change
    const watcher = vscode.workspace.createFileSystemWatcher("**/.agents/*.{yaml,yml}");
    watcher.onDidCreate(() => this.pushState());
    watcher.onDidChange(() => this.pushState());
    watcher.onDidDelete(() => this.pushState());
    webviewView.onDidDispose(() => watcher.dispose());
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Push a fresh state (agent list + last run) to the webview */
  pushState(): void {
    if (!this.view) {
      return;
    }
    const loader = new AgentLoader(this.outputChannel);
    const defs = loader.loadAll();
    this.cachedDefs = defs;

    const agents: SidebarAgent[] = defs.map((d) =>
      d.kind === "agent"
        ? {
            name: d.name,
            kind: "agent",
            description: d.description,
            provider: d.provider,
            model: d.model,
            steps: [],
            source: d.sourcePath,
          }
        : {
            name: d.agent,
            kind: "workflow",
            description: d.description,
            steps: d.steps.map((s) => s.run),
            source: d.sourcePath,
          }
    );

    const message: WebviewMessage = {
      type: "state",
      payload: { agents, lastRun: this.lastRun },
    };
    void this.view.webview.postMessage(message);
  }

  /** Push an execution result to the webview */
  pushExecution(result: RunResult): void {
    this.lastRun = result;
    if (!this.view) {
      return;
    }
    const message: WebviewMessage = { type: "execution", payload: result };
    void this.view.webview.postMessage(message);
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async runByName(name: string): Promise<void> {
    const def = this.cachedDefs.find((d) => (d.kind === "agent" ? d.name : d.agent) === name);

    if (!def) {
      vscode.window.showErrorMessage(`DevAgents: Agent "${name}" not found.`);
      return;
    }

    this.outputChannel.show(true);

    try {
      let result: RunResult;
      if (def.kind === "workflow") {
        const runner = new WorkflowRunner(this.outputChannel);
        result = await runner.run(def);
      } else {
        const runner = new AgentRunner(this.outputChannel);
        result = await runner.run(def);
      }
      this.pushExecution(result);
    } catch (err) {
      vscode.window.showErrorMessage(`DevAgents: ${String(err)}`);
    }
  }

  // ─── HTML Builder ────────────────────────────────────────────────────────────

  private buildHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "sidebar.css")
    );
    const twCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "sidebar.js")
    );

    // Content-Security-Policy nonce for scripts
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}' ${webview.cspSource};" />
  <link rel="stylesheet" href="${twCssUri}" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>DevAgents</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
    ""
  );
}
