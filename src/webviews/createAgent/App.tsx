import { h, Fragment } from "preact";
import { useState } from "preact/hooks";
import { getVscodeApi } from "../shared/vscodeApi";
import type { EditDef } from "../shared/types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ProviderPicker } from "./components/ProviderPicker";
import { ContextGrid } from "./components/ContextGrid";
import { StepsEditor } from "./components/StepsEditor";

declare const AGENT_NAMES: string[];
declare const PREFILL: EditDef | null;

const vscode = getVscodeApi();

type Kind = "agent" | "workflow";
type Provider = "claude" | "codex" | "gemini";

const MODELS: Record<string, string[]> = {
  claude: ["opus", "sonnet", "haiku"],
  codex: ["gpt-5.4", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gpt-5.2-codex", "gpt-5.2"],
  gemini: ["gemini-3-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
};

function getInitialState() {
  if (!PREFILL) {
    return { kind: "agent" as Kind, name: "", description: "", provider: "claude" as Provider, model: "opus", context: ["selectedCode", "filePath"], prompt: "", steps: [""] };
  }
  if (PREFILL.kind === "workflow") {
    return { kind: "workflow" as Kind, name: PREFILL.agent ?? "", description: PREFILL.description ?? "", provider: "claude" as Provider, model: "", context: [] as string[], prompt: "", steps: PREFILL.steps?.length ? PREFILL.steps : [""] };
  }
  const provider = (PREFILL.provider ?? "claude") as Provider;
  return { kind: "agent" as Kind, name: PREFILL.name ?? "", description: PREFILL.description ?? "", provider, model: PREFILL.model ?? MODELS[provider]?.[0] ?? "", context: PREFILL.context ?? [], prompt: (PREFILL.prompt ?? "").replace(/^  /gm, ""), steps: [""] };
}

export function App() {
  const init = getInitialState();
  const [kind, setKind] = useState<Kind>(init.kind);
  const [name, setName] = useState(init.name);
  const [description, setDescription] = useState(init.description);
  const [provider, setProvider] = useState<Provider>(init.provider);
  const [model, setModel] = useState(init.model);
  const [context, setContext] = useState<string[]>(init.context);
  const [prompt, setPrompt] = useState(init.prompt);
  const [steps, setSteps] = useState<string[]>(init.steps);
  const [nameError, setNameError] = useState("");
  const [promptError, setPromptError] = useState("");
  const [stepsError, setStepsError] = useState("");

  const isEdit = PREFILL !== null;
  const pageTitle = isEdit
    ? `Edit ${PREFILL?.kind === "workflow" ? PREFILL?.agent ?? "Workflow" : PREFILL?.name ?? "Agent"}`
    : "New Agent";

  function handleProviderChange(p: Provider) { setProvider(p); setModel(MODELS[p]?.[0] ?? ""); }
  function handleContextChange(key: string, checked: boolean) {
    setContext((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  }

  function validate(): boolean {
    let ok = true;
    setNameError("");
    const trimName = name.trim();
    if (!trimName) { setNameError("Name is required."); ok = false; }
    else if (!/^[a-z0-9-]+$/.test(trimName)) { setNameError("Lowercase letters, numbers, and hyphens only."); ok = false; }
    if (kind === "agent") {
      setPromptError("");
      if (!prompt.trim()) { setPromptError("Prompt is required."); ok = false; }
    } else {
      setStepsError("");
      if (!steps.some((s) => s.trim())) { setStepsError("Add at least one step."); ok = false; }
    }
    return ok;
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate()) return;
    const base = { type: "submit" as const, kind, name: name.trim(), description: description.trim() };
    if (kind === "workflow") {
      vscode.postMessage({ ...base, steps: steps.filter((s) => s.trim()) });
    } else {
      vscode.postMessage({ ...base, provider, model, context, prompt: prompt.trim() });
    }
  }

  const saveBtnLabel = isEdit
    ? kind === "workflow" ? "Save Workflow" : "Save Agent"
    : kind === "workflow" ? "Create Workflow" : "Create Agent";

  const modelOptions = [...(MODELS[provider] ?? [])];
  if (model && !modelOptions.includes(model)) modelOptions.unshift(model);

  return (
    <Fragment>
      <header class="topbar">
        <div class="topbar-inner">
          <div class="topbar-brand">
            <BrandIcon />
            <span class="brand-name">DevAgents</span>
          </div>
          <span class="topbar-page">{pageTitle}</span>
        </div>
      </header>

      <main class="page">
        <form class="card" onSubmit={handleSubmit}>

          <section class="section">
            <Label className="section-label">Type</Label>
            <div class="flex gap-2">
              <Button type="button" variant={kind === "agent" ? "default" : "outline"} size="sm" onClick={() => setKind("agent")}>Agent</Button>
              <Button type="button" variant={kind === "workflow" ? "default" : "outline"} size="sm" onClick={() => setKind("workflow")}>Workflow</Button>
            </div>
          </section>

          <div class="divider" />

          <section class="section">
            <Label className="section-label">Details</Label>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-xs font-semibold">Name <span class="text-destructive">*</span></Label>
                <Input id="name" placeholder="code-review" autoComplete="off" spellcheck={false} value={name} className={nameError ? "border-destructive" : ""} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
                <span class="text-[11px] text-muted-foreground">Lowercase, numbers, hyphens</span>
                {nameError && <span class="text-[11px] text-destructive">{nameError}</span>}
              </div>
              <div class="flex flex-col gap-1.5">
                <Label htmlFor="desc" className="text-xs font-semibold">Description</Label>
                <Input id="desc" placeholder="Review code for bugs and improvements" autoComplete="off" value={description} onInput={(e) => setDescription((e.target as HTMLInputElement).value)} />
              </div>
            </div>
          </section>

          {kind === "agent" && (
            <Fragment>
              <div class="divider" />
              <ProviderPicker provider={provider} onChange={handleProviderChange} />
              <div class="divider" />

              <section class="section">
                <Label className="section-label">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <div class="divider" />
              <ContextGrid context={context} onChange={handleContextChange} />
              <div class="divider" />

              <section class="section">
                <Label className="section-label">Prompt <span class="text-destructive">*</span></Label>
                <p class="text-[12px] text-muted-foreground leading-relaxed">
                  Use{" "}
                  <code class="bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono">{"{{selectedCode}}"}</code>,{" "}
                  <code class="bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono">{"{{filePath}}"}</code>,{" "}
                  <code class="bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono">{"{{codebase}}"}</code>, etc.
                </p>
                <Textarea
                  id="prompt"
                  rows={12}
                  placeholder={"You are a helpful assistant.\n\nFile: {{filePath}}\n\n```\n{{selectedCode}}\n```\n\nTask: Review the code above."}
                  value={prompt}
                  className={`font-mono text-[12px] min-h-[180px] resize-y${promptError ? " border-destructive" : ""}`}
                  onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                />
                {promptError && <span class="text-[11px] text-destructive">{promptError}</span>}
              </section>
            </Fragment>
          )}

          {kind === "workflow" && (
            <Fragment>
              <div class="divider" />
              <StepsEditor steps={steps} agentNames={AGENT_NAMES} onChange={setSteps} />
              {stepsError && <span class="text-[11px] text-destructive pb-2">{stepsError}</span>}
            </Fragment>
          )}

          <div class="divider" />
          <div class="flex gap-2.5 pt-5! pb-1">
            <Button type="submit">{saveBtnLabel}</Button>
            <Button type="button" variant="outline" onClick={() => vscode.postMessage({ type: "cancel" })}>Cancel</Button>
          </div>
        </form>
      </main>
    </Fragment>
  );
}

function BrandIcon() {
  return (
    <svg class="brand-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <g transform="translate(0,512) scale(0.1,-0.1)">
        <path d="M2510 4785 c-556 -70 -1049 -363 -1337 -795 -50 -74 -133 -230 -133 -249 0 -6 118 -11 308 -13 l307 -3 76 -36 c196 -94 297 -307 244 -514 -40 -152 -144 -264 -294 -315 -56 -19 -85 -20 -414 -20 l-353 0 -13 -45 c-9 -30 -75 -133 -183 -286 -94 -132 -169 -242 -167 -243 2 -2 105 -52 229 -110 124 -59 235 -116 247 -128 22 -20 22 -25 25 -362 l3 -341 26 -56 c32 -68 83 -126 137 -157 l41 -23 195 289 c137 203 202 291 218 296 13 3 181 6 375 6 l352 0 228 247 c125 137 250 271 276 300 l49 52 -44 11 c-306 77 -551 315 -638 622 -33 113 -37 287 -11 413 32 154 109 300 219 416 139 146 290 231 479 267 l83 16 0 195 0 195 151 151 150 152 -58 16 c-205 58 -545 80 -773 52z" />
        <path d="M3352 4507 l-152 -152 0 -166 0 -165 83 -16 c418 -81 717 -440 717 -863 0 -347 -198 -654 -516 -801 -82 -38 -218 -74 -281 -74 l-42 0 -343 -372 -344 -373 -366 -3 -366 -2 -151 -224 c-83 -124 -151 -227 -151 -230 0 -3 148 -6 328 -6 328 0 329 0 349 -23 13 -13 63 -153 128 -352 58 -181 108 -331 109 -332 2 -2 128 54 282 124 l279 128 643 3 c353 1 642 4 642 7 0 2 -76 181 -169 397 -93 216 -175 415 -182 441 -22 88 15 289 69 376 15 25 73 85 130 134 278 242 456 538 533 889 26 119 36 369 20 491 -70 526 -420 990 -940 1247 -64 32 -125 60 -136 64 -16 5 -50 -24 -173 -147z" />
        <path d="M2947 3844 c-32 -7 -90 -29 -130 -47 -184 -87 -314 -232 -383 -432 -26 -73 -28 -92 -28 -220 0 -125 3 -149 27 -220 38 -115 91 -199 182 -290 199 -200 480 -262 746 -165 151 55 290 172 372 311 120 204 129 469 23 684 -90 182 -267 325 -462 375 -92 24 -258 26 -347 4z m302 -209 c251 -66 417 -322 372 -573 -62 -346 -428 -525 -746 -365 -67 35 -175 145 -208 213 -75 156 -75 303 -2 459 60 125 184 228 322 266 65 18 196 18 262 0z" />
        <path d="M2993 3469 c-71 -27 -155 -106 -190 -177 -23 -49 -27 -70 -28 -147 0 -79 4 -97 28 -147 70 -142 218 -220 373 -196 79 12 143 48 202 112 63 70 87 134 87 237 0 65 -5 85 -33 142 -40 80 -111 148 -188 176 -73 28 -180 27 -251 0z" />
        <path d="M956 3503 c-36 -154 -51 -310 -41 -424 l7 -79 337 0 c377 0 395 3 470 67 23 19 54 58 69 87 22 43 27 64 27 131 0 70 -4 87 -30 134 -16 29 -47 68 -68 87 -72 61 -96 64 -443 64 l-312 0 -16 -67z" />
      </g>
    </svg>
  );
}
