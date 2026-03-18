import { h } from "preact";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type Provider = "claude" | "codex" | "gemini";

const PROVIDERS: { value: Provider; name: string; sub: string }[] = [
  { value: "claude", name: "Claude", sub: "Anthropic" },
  { value: "codex", name: "Codex", sub: "OpenAI" },
  { value: "gemini", name: "Gemini", sub: "Google" },
];

export function ProviderPicker({
  provider,
  onChange,
}: {
  provider: Provider;
  onChange: (p: Provider) => void;
}) {
  return (
    <section class="section">
      <Label className="section-label">
        Provider <span class="text-destructive">*</span>
      </Label>
      <Select value={provider} onValueChange={(v) => onChange(v as Provider)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <span className="font-medium text-white">{p.name}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">— {p.sub}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}
