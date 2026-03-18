import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { runProcess } from "../utils/processRunner.js";
import type { AgentContext, ContextKey } from "../types.js";

// ─── Collector ────────────────────────────────────────────────────────────────

/**
 * Gather editor context values for the given context keys.
 * Always safe to call even if the editor has no active document.
 */
export async function collectContext(keys: ContextKey[]): Promise<AgentContext> {
  const editor = vscode.window.activeTextEditor;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  const ctx: AgentContext = {};

  for (const key of keys) {
    switch (key) {
      case "selectedCode":
        ctx.selectedCode = getSelectedCode(editor);
        break;

      case "filePath":
        ctx.filePath = editor?.document.uri.fsPath;
        break;

      case "workspacePath":
        ctx.workspacePath = workspaceFolder?.uri.fsPath;
        break;

      case "fileContent":
        ctx.fileContent = editor?.document.getText();
        break;

      case "gitDiff":
        ctx.gitDiff = await getGitDiff(workspaceFolder?.uri.fsPath);
        break;

      case "codebase":
        ctx.codebase = workspaceFolder
          ? collectCodebase(workspaceFolder.uri.fsPath)
          : undefined;
        break;
    }
  }

  return ctx;
}

/**
 * Collect all available context regardless of agent configuration.
 */
export async function collectFullContext(): Promise<AgentContext> {
  return collectContext([
    "selectedCode",
    "filePath",
    "workspacePath",
    "fileContent",
    "gitDiff",
    "codebase",
  ]);
}

// ─── Codebase Walker ──────────────────────────────────────────────────────────

/**
 * Directories that are always skipped regardless of .gitignore.
 * Keeps the prompt focused on actual source code.
 */
const ALWAYS_SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", "dist", "build", "out",
  ".next", ".nuxt", ".cache", ".turbo", "coverage", "__pycache__",
  ".mypy_cache", ".pytest_cache", "vendor", ".yarn", ".pnp",
  "target",   // Rust / Java Maven
  "bin", "obj", // .NET
]);

/** Binary / generated extensions that are never useful as text context. */
const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".mp4", ".mp3", ".wav", ".pdf", ".zip", ".tar", ".gz", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
  ".min.js", ".min.css",
  ".lock",          // package-lock.json, yarn.lock, Cargo.lock — very noisy
  ".map",           // source maps
  ".wasm",
]);

/** Max bytes to read per file before truncating. ~40 KB is plenty for most files. */
const MAX_FILE_BYTES = 40_000;

/** Max total codebase snapshot size sent to the AI. */
const MAX_TOTAL_BYTES = 400_000;

/**
 * Walk the workspace root and concatenate readable text files into a single
 * string formatted as fenced code blocks with relative path headers.
 *
 * Respects:
 *  - ALWAYS_SKIP_DIRS
 *  - SKIP_EXTENSIONS
 *  - per-file and total byte caps
 *  - .gitignore patterns (via `git ls-files` when git is available)
 */
function collectCodebase(rootPath: string): string {
  const files = listSourceFiles(rootPath);
  const parts: string[] = [`# Codebase — ${path.basename(rootPath)}\n`];
  let totalBytes = 0;

  for (const absPath of files) {
    if (totalBytes >= MAX_TOTAL_BYTES) {
      parts.push(`\n> ⚠ Snapshot truncated — total size limit (${MAX_TOTAL_BYTES / 1000} KB) reached.`);
      break;
    }

    let content: string;
    try {
      const buf = fs.readFileSync(absPath);
      // Skip binary files (null bytes are a reliable heuristic)
      if (buf.includes(0)) {
        continue;
      }
      content = buf.length > MAX_FILE_BYTES
        ? buf.slice(0, MAX_FILE_BYTES).toString("utf8") + "\n… (truncated)"
        : buf.toString("utf8");
    } catch {
      continue;
    }

    const rel = path.relative(rootPath, absPath);
    const ext = getExtension(absPath);
    const lang = EXT_TO_LANG[ext] ?? ext.slice(1) ?? "";

    const block = `\n## ${rel}\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
    totalBytes += block.length;
    parts.push(block);
  }

  return parts.join("");
}

/**
 * Return absolute paths of all source files under rootPath,
 * preferring `git ls-files` (which respects .gitignore) and
 * falling back to a manual walk.
 */
function listSourceFiles(rootPath: string): string[] {
  // Try git ls-files first — fast and respects .gitignore
  try {
    const { execSync } = require("child_process") as typeof import("child_process");
    const output = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: rootPath,
      encoding: "utf8",
      timeout: 5_000,
    });
    return output
      .trim()
      .split("\n")
      .filter((f) => f && !shouldSkipByExtension(f))
      .map((f) => path.join(rootPath, f))
      .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  } catch {
    // Not a git repo or git not installed — fall back to manual walk
    return walkDir(rootPath, rootPath);
  }
}

function walkDir(dir: string, root: string): string[] {
  let results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") {
      continue; // skip hidden files/dirs (except .env.example as docs)
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP_DIRS.has(entry.name)) {
        continue;
      }
      results = results.concat(walkDir(fullPath, root));
    } else if (entry.isFile() && !shouldSkipByExtension(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function shouldSkipByExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of SKIP_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/** Maps common file extensions to markdown fence language identifiers. */
const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c", ".h": "c",
  ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".yaml": "yaml", ".yml": "yaml",
  ".json": "json",
  ".toml": "toml",
  ".md": "markdown",
  ".sql": "sql",
  ".html": "html", ".htm": "html",
  ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
  ".xml": "xml",
  ".tf": "hcl",
  ".dockerfile": "dockerfile",
};

// ─── Editor Helpers ───────────────────────────────────────────────────────────

function getSelectedCode(editor: vscode.TextEditor | undefined): string | undefined {
  if (!editor) {
    return undefined;
  }
  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }
  return editor.document.getText(selection);
}

async function getGitDiff(cwd: string | undefined): Promise<string | undefined> {
  if (!cwd) {
    return undefined;
  }
  try {
    const result = await runProcess({
      command: "git",
      args: ["diff", "--stat", "HEAD"],
      cwd,
      timeoutMs: 5_000,
    });
    return result.stdout || undefined;
  } catch {
    return undefined;
  }
}

// ─── Prompt Template Renderer ─────────────────────────────────────────────────

/**
 * Render a prompt template by substituting {{key}} placeholders.
 * Unknown placeholders are left as-is.
 */
export function renderPrompt(template: string, ctx: AgentContext): string {
  const substitutions: Record<string, string | undefined> = {
    selectedCode: ctx.selectedCode,
    filePath: ctx.filePath
      ? path.basename(ctx.filePath) + ` (${ctx.filePath})`
      : undefined,
    workspacePath: ctx.workspacePath,
    gitDiff: ctx.gitDiff,
    fileContent: ctx.fileContent,
    codebase: ctx.codebase,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = substitutions[key];
    return value !== undefined ? value : match;
  });
}
