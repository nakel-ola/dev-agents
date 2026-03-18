# Changelog

All notable changes to DevAgents are documented here.

## [1.0.0] — 2026-03-18

### Added
- Sidebar webview for browsing, running, and editing agents and workflows
- Create / Edit Agent panel with form validation and pre-fill for edit mode
- Support for Claude, OpenAI Codex, and Gemini CLI providers
- YAML-based agent definitions stored in a workspace `.agents/` folder
- Workflow definitions that chain multiple agents in sequence
- Context variables injected into prompts: `{{selectedCode}}`, `{{filePath}}`, `{{fileContent}}`, `{{gitDiff}}`, `{{workspacePath}}`, `{{codebase}}`
- Right-click context menu commands: **Run Agent** and **Run Agent On Selection**
- Command palette commands for all extension actions
- Configurable provider CLI commands and arguments per provider
- Configurable provider execution timeout
- Verbose prompt logging option
- Automatic `.agents/` folder creation on first use
- Built with Preact + shadcn/ui + Tailwind CSS v4
