# DevAgents

DevAgents is a production-ready VS Code extension for creating, managing, and running reusable AI agents powered by external CLIs such as Claude, OpenAI Codex, and Gemini.

## Features

- Create reusable YAML agents in a project-level `.agents/` folder
- Run agents on the current editor context or only the current selection
- Support multiple AI CLIs through modular provider adapters
- Chain agents together using workflow definitions
- Manage agents from a sidebar webview
- View logs, outputs, and errors in the `DevAgents` output channel

## Agent Files

Store agents and workflows in your workspace `.agents/` directory.

### Agent example

```yaml
name: code-review
description: Review code for bugs and improvements
provider: claude
model: opus
context:
  - selectedCode
  - filePath
  - gitDiff
prompt: |
  Review this code for:
  - bugs
  - performance issues
  - security problems
  Provide improvements.
```

### Workflow example

```yaml
agent: pr-review
description: Run a pull request review workflow
steps:
  - run: code-review
  - run: security-audit
  - run: documentation-check
```

## Commands

- `DevAgents: Run Agent`
- `DevAgents: Run Agent On Selection`
- `DevAgents: Create Agent`
- `DevAgents: Open Agent Panel`

## Provider Configuration

Configure CLI commands in VS Code settings:

- `devagents.providers.claude.command`
- `devagents.providers.claude.args`
- `devagents.providers.codex.command`
- `devagents.providers.codex.args`
- `devagents.providers.gemini.command`
- `devagents.providers.gemini.args`
- `devagents.providerTimeoutMs`

Argument arrays support:

- `{prompt}` for the rendered prompt
- `{model}` for the configured model

If `{prompt}` is not included in the args, DevAgents sends the prompt over stdin.

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the extension host.
