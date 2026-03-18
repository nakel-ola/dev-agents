import * as vscode from "vscode";
import { AgentSidebarProvider } from "./views/agentSidebarProvider.js";
import { runAgentCommand } from "./commands/runAgent.js";
import { runAgentOnSelectionCommand } from "./commands/runAgentOnSelection.js";
import { createAgentCommand } from "./commands/createAgent.js";
import { CreateAgentPanel } from "./views/createAgentPanel.js";
import { AgentLoader } from "./agentEngine/agentLoader.js";
import { WorkflowRunner } from "./agentEngine/workflowRunner.js";

// ─── Extension Entry Point ────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // ── Output channel ─────────────────────────────────────────────────────────
  const outputChannel = vscode.window.createOutputChannel("DevAgents");
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine("[DevAgents] Extension activating…");

  // ── Sidebar provider ───────────────────────────────────────────────────────
  const sidebarProvider = new AgentSidebarProvider(outputChannel, context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AgentSidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // ── Commands ───────────────────────────────────────────────────────────────

  // devagents.runAgent — pick and run any agent or workflow
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.runAgent", async (agentName?: string) => {
      const result = await runAgentCommand(outputChannel, agentName);
      if (result) {
        sidebarProvider.pushExecution(result);
      }
    })
  );

  // devagents.runAgentOnSelection — run an agent scoped to selected text
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.runAgentOnSelection", async () => {
      const result = await runAgentOnSelectionCommand(outputChannel);
      if (result) {
        sidebarProvider.pushExecution(result);
      }
    })
  );

  // devagents.createAgent — open the Create Agent webview panel
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.createAgent", async () => {
      await createAgentCommand(outputChannel, context.extensionUri);
      sidebarProvider.pushState();
    })
  );

  // devagents.openAgentPanel — reveal the sidebar view
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.openAgentPanel", async () => {
      await vscode.commands.executeCommand("devagents.sidebar.focus");
    })
  );

  // devagents.refreshAgents — reload agents from disk
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.refreshAgents", () => {
      sidebarProvider.pushState();
      outputChannel.appendLine("[DevAgents] Agents refreshed.");
    })
  );

  // devagents.editAgent — open the Edit Agent panel pre-filled with an existing definition
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.editAgent", async (agentName?: string) => {
      const loader = new AgentLoader(outputChannel);
      const defs = loader.loadAll();

      let def = agentName
        ? defs.find((d) => (d.kind === "agent" ? d.name : d.agent) === agentName)
        : undefined;

      // No name supplied — let the user pick from a QuickPick.
      if (!def) {
        const items = defs.map((d) => ({
          label: d.kind === "agent" ? d.name : d.agent,
          description: d.kind,
          detail: d.description,
        }));
        const picked = await vscode.window.showQuickPick(items, {
          title: "DevAgents: Select agent or workflow to edit",
          placeHolder: "Type to filter…",
          matchOnDescription: true,
        });
        if (!picked) {
          return;
        }
        def = defs.find((d) =>
          (d.kind === "agent" ? d.name : d.agent) === picked.label
        );
        if (!def) {
          return;
        }
      }

      // Build the EditDef from the parsed definition.
      const editDef =
        def.kind === "workflow"
          ? {
              kind: "workflow" as const,
              sourcePath: def.sourcePath,
              agent: def.agent,
              description: def.description,
              steps: def.steps.map((s) => s.run),
            }
          : {
              kind: "agent" as const,
              sourcePath: def.sourcePath,
              name: def.name,
              description: def.description,
              provider: def.provider,
              model: def.model,
              context: def.context ?? [],
              prompt: def.prompt,
            };

      CreateAgentPanel.openForEdit(outputChannel, context.extensionUri, editDef);
      sidebarProvider.pushState();
    })
  );

  // devagents.deleteAgent — delete an agent YAML file
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.deleteAgent", async (agentName?: string) => {
      const loader = new AgentLoader(outputChannel);
      const defs = loader.loadAll();

      let targetPath: string | undefined;

      if (agentName) {
        const def = defs.find((d) => (d.kind === "agent" ? d.name : d.agent) === agentName);
        targetPath = def?.sourcePath;
      }

      if (!targetPath) {
        const items = defs.map((d) => ({
          label: d.kind === "agent" ? d.name : d.agent,
          description: d.sourcePath,
        }));
        const picked = await vscode.window.showQuickPick(items, {
          title: "DevAgents: Delete Agent",
          placeHolder: "Select an agent to delete",
        });
        if (!picked) {
          return;
        }
        targetPath = picked.description;
      }

      if (!targetPath) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Delete agent file "${targetPath}"? This cannot be undone.`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") {
        return;
      }

      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(targetPath));
        outputChannel.appendLine(`[DevAgents] Deleted: ${targetPath}`);
        sidebarProvider.pushState();
      } catch (err) {
        vscode.window.showErrorMessage(`DevAgents: Could not delete file: ${String(err)}`);
      }
    })
  );

  // devagents.runWorkflow — pick and run a workflow specifically
  context.subscriptions.push(
    vscode.commands.registerCommand("devagents.runWorkflow", async (workflowName?: string) => {
      const loader = new AgentLoader(outputChannel);
      const defs = loader.loadAll().filter((d) => d.kind === "workflow");

      if (defs.length === 0) {
        vscode.window.showWarningMessage(
          "DevAgents: No workflow files found. Create a `.workflow.yaml` file in your `.agents/` folder."
        );
        return;
      }

      // All entries in defs are workflows (filtered above)
      const workflowDefs = defs.filter(
        (d): d is { kind: "workflow" } & import("./types.js").WorkflowDefinition =>
          d.kind === "workflow"
      );

      let selectedName = workflowName;
      if (!selectedName) {
        const items = workflowDefs.map((d) => ({
          label: d.agent,
          detail: d.description,
        }));
        const picked = await vscode.window.showQuickPick(items, {
          title: "DevAgents: Run Workflow",
          placeHolder: "Select a workflow…",
        });
        if (!picked) {
          return;
        }
        selectedName = picked.label;
      }

      const def = workflowDefs.find((d) => d.agent === selectedName);
      if (!def) {
        vscode.window.showErrorMessage(`DevAgents: Workflow "${selectedName}" not found.`);
        return;
      }

      outputChannel.show(true);
      try {
        const runner = new WorkflowRunner(outputChannel);
        const result = await runner.run(def);
        sidebarProvider.pushExecution(result);
      } catch (err) {
        vscode.window.showErrorMessage(`DevAgents: ${String(err)}`);
      }
    })
  );

  // ── Workspace file watcher — refresh sidebar on agent changes ──────────────
  const watcher = vscode.workspace.createFileSystemWatcher("**/.agents/*.{yaml,yml}");
  watcher.onDidCreate(() => sidebarProvider.pushState());
  watcher.onDidChange(() => sidebarProvider.pushState());
  watcher.onDidDelete(() => sidebarProvider.pushState());
  context.subscriptions.push(watcher);

  outputChannel.appendLine("[DevAgents] Extension activated.");
}

export function deactivate(): void {
  // Nothing to clean up — VS Code disposes context.subscriptions automatically
}
