import { h } from "preact";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";

const CONTEXT_KEYS = [
  { value: "selectedCode", desc: "Text selected in the editor" },
  { value: "filePath", desc: "Path of the active file" },
  { value: "fileContent", desc: "Entire active file" },
  { value: "gitDiff", desc: "Current git diff" },
  { value: "workspacePath", desc: "Workspace root path" },
  { value: "codebase", desc: "All source files in workspace" },
];

export function ContextGrid({ context, onChange }: { context: string[]; onChange: (key: string, checked: boolean) => void }) {
  return (
    <section class="section">
      <Label className="section-label">Context</Label>
      <p class="text-[12px] text-muted-foreground leading-relaxed">
        Variables injected into <code class="bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono">{"{{placeholder}}"}</code> slots in your prompt.
      </p>
      <div class="grid grid-cols-2 gap-1.5">
        {CONTEXT_KEYS.map((k) => (
          <label
            key={k.value}
            class="flex items-start gap-2.5 p-2! rounded-md border border-transparent hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <Checkbox
              id={k.value}
              checked={context.includes(k.value)}
              onCheckedChange={(checked) => onChange(k.value, checked === true)}
              className="mt-0.5"
            />
            <div class="flex flex-col gap-0.5">
              <span class="font-mono text-xs font-semibold">{k.value}</span>
              <span class="text-[11px] text-muted-foreground leading-snug">{k.desc}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
