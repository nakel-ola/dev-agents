import { h } from "preact";
import type { RunResult } from "../../shared/types";
import { Badge } from "../../components/ui/badge";

export function OutputPanel({ lastRun }: { lastRun: RunResult | null }) {
  if (!lastRun) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
        Run an agent to see output here.
      </p>
    );
  }

  const parts = [
    lastRun.kind,
    lastRun.provider ?? (lastRun.kind === "workflow" ? "workflow" : undefined),
    lastRun.durationMs ? `${lastRun.durationMs}ms` : undefined,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground truncate">{lastRun.name}</span>
        <Badge variant="secondary" className="text-[10px] shrink-0">done</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{parts.join(" • ")}</p>
      <pre className="text-[11px] bg-muted rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
        {lastRun.output}
      </pre>
    </div>
  );
}
