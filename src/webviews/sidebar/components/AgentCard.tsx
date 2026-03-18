import { h } from "preact";
import { getVscodeApi } from "../../shared/vscodeApi";
import type { SidebarAgent } from "../../shared/types";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

const vscode = getVscodeApi();

export function AgentCard({ agent }: { agent: SidebarAgent }) {
  const meta =
    agent.kind === "agent"
      ? `${agent.provider}${agent.model ? ` • ${agent.model}` : ""}`
      : `${agent.steps.length} step${agent.steps.length === 1 ? "" : "s"}`;

  return (
    <article class="agent-card">
      <div class="agent-topline">
        <h3 class="agent-name">{agent.name}</h3>
        <Badge variant="secondary" className="agent-kind text-[10px]">{agent.kind}</Badge>
      </div>
      <p class="agent-desc">{agent.description ?? "No description provided."}</p>
      <p class="meta">{meta}</p>
      <div class="agent-actions">
        <Button size="sm" onClick={() => vscode.postMessage({ type: "runAgent", payload: { name: agent.name } })}>
          Run
        </Button>
        <Button size="sm" variant="outline" onClick={() => vscode.postMessage({ type: "editAgent", payload: { source: agent.source } })}>
          Edit
        </Button>
      </div>
    </article>
  );
}
