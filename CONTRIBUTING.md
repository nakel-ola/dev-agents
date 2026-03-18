# Contributing to DevAgents

Thank you for your interest in contributing!

## Getting started

```bash
git clone https://github.com/devagents/devagents
cd devagents
npm install
npm run compile
```

Press **F5** in VS Code to open an Extension Development Host with the extension loaded.

## Project structure

```
src/
  extension.ts          # Entry point — registers commands and sidebar
  agentEngine/          # Agent loading, running, and workflow orchestration
  views/                # VS Code webview providers (sidebar, create/edit panel)
  webviews/             # Preact UI source (bundled by esbuild into media/)
    createAgent/        # Create/Edit Agent panel
    sidebar/            # Sidebar webview
    components/ui/      # shadcn/ui components
    styles/globals.css  # Tailwind v4 entry + theme tokens
  types.ts              # Shared TypeScript types
media/                  # Built webview assets (JS, CSS, icons)
.agents/                # Example workspace agent files (not shipped)
```

## Build

| Command | Description |
|---------|-------------|
| `npm run compile` | Full build (TypeScript + esbuild + Tailwind) |
| `npm run compile:ext` | Extension host TypeScript only |
| `npm run compile:webview` | Webview JS + CSS only |
| `npm run watch:ext` | Watch extension host |
| `npm run watch:webview` | Watch webview bundle |
| `npm run package` | Package `.vsix` for local install |

## Adding a provider

1. Add the provider name to `ProviderName` in `src/types.ts`.
2. Add a case in `src/agentEngine/agentRunner.ts` to build the CLI args.
3. Add default settings in `package.json` under `contributes.configuration`.
4. Add the provider to `PROVIDERS` in `src/webviews/createAgent/components/ProviderPicker.tsx`.

## Adding a context variable

1. Add the key to the `ContextKey` type in `src/types.ts`.
2. Resolve the value in `src/agentEngine/contextResolver.ts`.
3. Add the checkbox entry in `src/webviews/createAgent/components/ContextGrid.tsx`.

## Pull requests

- Keep PRs focused — one feature or fix per PR.
- Run `npm run compile` before submitting to ensure the build is clean.
- Follow the existing code style (TypeScript strict mode, Preact functional components).

## Reporting issues

Open an issue on GitHub with steps to reproduce, VS Code version, and OS.
