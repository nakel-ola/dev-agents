import { spawn } from "child_process";
import * as vscode from "vscode";

export interface ProcessOptions {
  /** Command to execute */
  command: string;
  /** Arguments list */
  args: string[];
  /** Optional working directory */
  cwd?: string;
  /** Optional stdin to pipe to the process */
  stdin?: string;
  /** Timeout in milliseconds (default: 120 000) */
  timeoutMs?: number;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn a child process and collect stdout / stderr.
 * Rejects on timeout, non-zero exit, or spawn error.
 */
export function runProcess(options: ProcessOptions): Promise<ProcessResult> {
  const {
    command,
    args,
    cwd,
    stdin,
    timeoutMs = vscode.workspace
      .getConfiguration("devagents")
      .get<number>("providerTimeoutMs", 120_000),
  } = options;

  return new Promise<ProcessResult>((resolve, reject) => {
    let killed = false;

    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: { ...process.env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    // Feed prompt via stdin if requested
    if (stdin !== undefined) {
      child.stdin.end(stdin, "utf8");
    }

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      reject(
        new Error(
          `Process "${command}" timed out after ${timeoutMs}ms.`
        )
      );
    }, timeoutMs);

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `CLI executable not found: "${command}". ` +
              `Make sure it is installed and available on your PATH.`
          )
        );
      } else {
        reject(new Error(`Failed to launch "${command}": ${err.message}`));
      }
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (killed) {
        return; // already rejected via timer
      }
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(
          new Error(
            `"${command}" exited with code ${exitCode}.\n` +
              (stderr ? `stderr:\n${stderr}` : "(no stderr output)")
          )
        );
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}
