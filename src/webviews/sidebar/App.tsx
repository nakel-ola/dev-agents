import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { getVscodeApi } from "../shared/vscodeApi";
import type { SidebarAgent, RunResult, WebviewMessage } from "../shared/types";
import { AgentCard } from "./components/AgentCard";
import { OutputPanel } from "./components/OutputPanel";
import { Button } from "../components/ui/button";

const vscode = getVscodeApi();

export function App() {
  const [agents, setAgents] = useState<SidebarAgent[]>([]);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as WebviewMessage;
      if (msg.type === "state") {
        setAgents(msg.payload.agents);
        setLastRun(msg.payload.lastRun);
      } else if (msg.type === "execution") {
        setLastRun(msg.payload);
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-foreground">DevAgents</h1>
        <p className="text-xs text-muted-foreground">AI-powered agents for your workspace.</p>
      </header>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => vscode.postMessage({ type: "createAgent" })}>
          + New Agent
        </Button>
        <Button size="sm" variant="outline" onClick={() => vscode.postMessage({ type: "refresh" })}>
          ↻
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Agents &amp; Workflows
        </h2>
        <div className="flex flex-col gap-2">
          {agents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No agents found in the current workspace.
            </p>
          ) : (
            agents.map((agent) => <AgentCard key={agent.source} agent={agent} />)
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Last Output
        </h2>
        <OutputPanel lastRun={lastRun} />
      </section>
    </div>
  );
}
