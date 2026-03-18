import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// One shared terminal per provider name so we don't spawn a new one every run.
const terminalMap = new Map<string, vscode.Terminal>();

/**
 * Write the prompt to a temp file and run the CLI command in a VSCode terminal.
 * Returns immediately — output is shown interactively in the terminal panel.
 */
export function runInTerminal(
  command: string,
  extraArgs: string[], // e.g. ["--model", "opus"] — must NOT include the prompt arg
  prompt: string,
  terminalName: string
): void {
  // Write prompt to a temp file so we avoid shell-escaping problems with long prompts.
  const tmpFile = path.join(os.tmpdir(), `devagents-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, "utf8");

  const terminal = getOrCreateTerminal(terminalName);
  terminal.show(/* preserveFocus */ false);

  // Build the shell line:  command [extraArgs...] < /tmp/devagents-xxx.txt
  const argStr = extraArgs.map(shellQuote).join(" ");
  const line = argStr
    ? `${shellQuote(command)} ${argStr} < ${shellQuote(tmpFile)}`
    : `${shellQuote(command)} < ${shellQuote(tmpFile)}`;

  terminal.sendText(line, /* addNewLine */ true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateTerminal(name: string): vscode.Terminal {
  // Reuse if the terminal is still alive
  const existing = terminalMap.get(name);
  if (existing && isAlive(existing)) {
    return existing;
  }
  const terminal = vscode.window.createTerminal({ name });
  terminalMap.set(name, terminal);
  // Clean up the map entry when the user closes the terminal
  vscode.window.onDidCloseTerminal((t) => {
    if (t === terminal) {
      terminalMap.delete(name);
    }
  });
  return terminal;
}

function isAlive(terminal: vscode.Terminal): boolean {
  return vscode.window.terminals.includes(terminal);
}

/** Wrap a string in single quotes, escaping any embedded single quotes. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
