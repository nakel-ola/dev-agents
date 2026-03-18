import type { AIProvider, ProviderName } from "../types.js";
import { ClaudeProvider } from "./claudeProvider.js";
import { CodexProvider } from "./codexProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<ProviderName, AIProvider>([
  ["claude", new ClaudeProvider()],
  ["codex", new CodexProvider()],
  ["gemini", new GeminiProvider()],
]);

/**
 * Look up a registered AI provider by name.
 * Throws if the name is not supported.
 */
export function getProvider(name: ProviderName): AIProvider {
  const provider = registry.get(name);
  if (!provider) {
    throw new Error(
      `Unsupported AI provider: "${name}". ` +
        `Supported providers: ${[...registry.keys()].join(", ")}.`
    );
  }
  return provider;
}

export type { AIProvider };
