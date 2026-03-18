# DevAgents

Create, manage, and run reusable AI agents inside VS Code — powered by Claude, OpenAI Codex, and Gemini CLIs.

Agents are defined as plain YAML files stored in your workspace. You can run them on the current file, on a selection, or chain them into multi-step workflows — all without leaving the editor.

---

## Features

- **Sidebar panel** — browse, run, and edit all agents and workflows in one place
- **Create & Edit** — full-featured form to build agents or workflows with live validation
- **Multiple providers** — Claude (Anthropic), Codex (OpenAI), and Gemini (Google)
- **Context variables** — inject `{{selectedCode}}`, `{{filePath}}`, `{{fileContent}}`, `{{gitDiff}}`, `{{workspacePath}}`, and `{{codebase}}` into prompts automatically
- **Workflows** — chain agents together in a named sequence
- **Editor integration** — right-click any selection to run an agent on it
- **Configurable** — every CLI command, argument, and timeout is configurable per provider

---

## Quick start

1. Install the extension.
2. Open a workspace folder.
3. Click the **DevAgents** icon in the Activity Bar.
4. Click **+ New Agent** to create your first agent.
5. Press **Run** to execute it against your current file.

---

## Agent definition

Store agents in a `.agents/` folder at the root of your workspace.

```yaml
# .agents/code-review.agent.yaml
name: code-review
description: Review code for bugs, performance, and security
provider: claude
model: opus
context:
  - selectedCode
  - filePath
  - gitDiff
prompt: |
  You are a senior engineer. Review the following code.

  File: {{filePath}}

  ```
  {{selectedCode}}
  ```

  Identify bugs, performance issues, and security problems. Be concise.
```

---

## Workflow definition

Chain agents into a workflow that runs each step in sequence.

```yaml
# .agents/pr-review.workflow.yaml
agent: pr-review
description: Full PR review pipeline
steps:
  - run: code-review
  - run: security-audit
  - run: documentation-check
```

---

## Context variables

| Variable | Description |
|---|---|
| `{{selectedCode}}` | Text selected in the active editor |
| `{{filePath}}` | Path of the active file |
| `{{fileContent}}` | Full content of the active file |
| `{{gitDiff}}` | Current unstaged git diff |
| `{{workspacePath}}` | Workspace root path |
| `{{codebase}}` | All source files in the workspace |

---

## Commands

| Command | Description |
|---|---|
| `DevAgents: Run Agent` | Pick and run an agent on the current file |
| `DevAgents: Run Agent On Selection` | Pick and run an agent on the selected text |
| `DevAgents: Create Agent` | Open the Create Agent form |
| `DevAgents: Open Agent Panel` | Reveal the sidebar |
| `DevAgents: Refresh Agents` | Reload agent definitions from disk |
| `DevAgents: Edit Agent` | Open an agent in the editor form |
| `DevAgents: Delete Agent` | Delete an agent definition file |
| `DevAgents: Run Workflow` | Pick and run a workflow |

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `devagents.agentsFolder` | `.agents` | Folder for agent/workflow YAML files |
| `devagents.autoOpenOutput` | `true` | Show output channel when an agent runs |
| `devagents.outputVerbose` | `false` | Log the full rendered prompt |
| `devagents.providerTimeoutMs` | `120000` | CLI execution timeout (ms) |
| `devagents.providers.claude.command` | `claude` | Claude CLI executable |
| `devagents.providers.claude.args` | `["-p", "{prompt}"]` | Claude CLI arguments |
| `devagents.providers.codex.command` | `codex` | Codex CLI executable |
| `devagents.providers.codex.args` | `["exec", "{prompt}"]` | Codex CLI arguments |
| `devagents.providers.gemini.command` | `gemini` | Gemini CLI executable |
| `devagents.providers.gemini.args` | `["-p", "{prompt}"]` | Gemini CLI arguments |

Use `{prompt}` and `{model}` as placeholders in args arrays. If `{prompt}` is omitted, the prompt is sent over stdin.

---

## Requirements

Each provider requires its CLI to be installed and authenticated:

- **Claude** — [claude.ai/code](https://claude.ai/code)
- **Codex** — [OpenAI Codex CLI](https://github.com/openai/codex)
- **Gemini** — [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)

---

## License

[MIT](LICENSE)
