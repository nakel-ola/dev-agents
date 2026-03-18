import { h } from "preact";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Plus, X } from "lucide-react";

export function StepsEditor({ steps, agentNames, onChange }: { steps: string[]; agentNames: string[]; onChange: (steps: string[]) => void }) {
  function updateStep(index: number, value: string) {
    const next = [...steps];
    next[index] = value;
    onChange(next);
  }
  function removeStep(index: number) { onChange(steps.filter((_, i) => i !== index)); }

  return (
    <section class="section">
      <Label className="section-label">Steps <span class="text-destructive">*</span></Label>
      <p class="text-[12px] text-muted-foreground leading-relaxed">
        Each step runs a named agent in order. The output of one step is passed as context to the next.
      </p>
      <div class="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} class="flex items-center gap-2">
            <span class="text-[11px] text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
            {agentNames.length === 0 ? (
              <select class="flex h-9 flex-1 rounded-md border border-border bg-input px-3 py-1 text-sm text-muted-foreground" disabled>
                <option>No agents found — create one first</option>
              </select>
            ) : (
              <select
                class="flex h-9 flex-1 rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                value={step}
                onChange={(e) => updateStep(i, (e.target as HTMLSelectElement).value)}
              >
                <option value="" disabled>— select an agent —</option>
                {agentNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeStep(i)}>
              <X class="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start mt-1 border-dashed" onClick={() => onChange([...steps, ""])}>
        <Plus class="h-3.5 w-3.5 mr-1" /> Add step
      </Button>
    </section>
  );
}
