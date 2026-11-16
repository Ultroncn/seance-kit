import * as Dialog from "@radix-ui/react-dialog";
import type { ProviderConfig, ProviderKind } from "@seance/llm";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { Button, Input } from "./primitives";
import { useProviderMode } from "./ProviderMode";

type Choice = "demo" | ProviderKind;

type Kind = Exclude<Choice, "demo">;

/**
 * Keys and model names are kept per provider. A key typed for one provider is never shown in,
 * tested against, or saved for another one.
 */
interface Form {
  choice: Choice;
  keys: Record<"anthropic" | "openai-compatible", string>;
  models: Record<Kind, string>;
  baseUrl: string;
  host: string;
}

const EMPTY: Form = {
  choice: "demo",
  keys: { anthropic: "", "openai-compatible": "" },
  models: { anthropic: "", "openai-compatible": "", ollama: "" },
  baseUrl: "https://api.openai.com/v1",
  host: "",
};

function formFrom(config: ProviderConfig | null): Form {
  if (!config) return EMPTY;
  const models = { ...EMPTY.models, [config.kind]: config.model };
  switch (config.kind) {
    case "anthropic":
      return {
        ...EMPTY,
        choice: "anthropic",
        keys: { ...EMPTY.keys, anthropic: config.apiKey },
        models,
      };
    case "openai-compatible":
      return {
        ...EMPTY,
        choice: "openai-compatible",
        keys: { ...EMPTY.keys, "openai-compatible": config.apiKey },
        models,
        baseUrl: config.baseUrl,
      };
    case "ollama":
      return { ...EMPTY, choice: "ollama", models, host: config.host ?? "" };
  }
}

function configFrom(f: Form): ProviderConfig | null {
  const t = (s: string) => s.trim();
  switch (f.choice) {
    case "demo":
      return null;
    case "anthropic":
      return { kind: "anthropic", apiKey: t(f.keys.anthropic), model: t(f.models.anthropic) };
    case "openai-compatible":
      return {
        kind: "openai-compatible",
        apiKey: t(f.keys["openai-compatible"]),
        model: t(f.models["openai-compatible"]),
        baseUrl: t(f.baseUrl),
      };
    case "ollama":
      return {
        kind: "ollama",
        model: t(f.models.ollama),
        ...(t(f.host) ? { host: t(f.host) } : {}),
      };
  }
}

/** Keys travel only over https. Plain http is allowed for servers on this machine. */
export function isAllowedEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/** Ready-to-save settings, or a plain reason why not. */
function validate(f: Form): string | null {
  if (f.choice === "demo") return null;
  if (f.choice !== "ollama" && f.keys[f.choice].trim() === "") return "Enter your API key.";
  if (f.models[f.choice].trim() === "") return "Enter a model name.";
  if (f.choice === "openai-compatible" && !isAllowedEndpoint(f.baseUrl))
    return "Enter a base URL starting with https:// (http:// only for localhost).";
  if (f.choice === "ollama" && f.host.trim() !== "" && !/^https?:\/\/\S+$/.test(f.host.trim()))
    return "Enter a host URL such as http://localhost:11434.";
  return null;
}

const CHOICES: { value: Choice; label: string; note: string }[] = [
  {
    value: "demo",
    label: "Demo (scripted)",
    note: "No key needed. Replies are scripted and the Demo-mode badge stays on.",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    note: "Your browser calls api.anthropic.com directly with your key.",
  },
  {
    value: "openai-compatible",
    label: "OpenAI-compatible",
    note: "OpenAI or any server with the same API. It must allow requests from this page (CORS).",
  },
  {
    value: "ollama",
    label: "Ollama (local)",
    note: "Runs on your machine. Start Ollama with OLLAMA_ORIGINS set to this site's address.",
  },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-fg">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function defaultDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after all local data is deleted, for example to clear the search index in memory. */
  onAfterWipe?: () => void;
  /** File name prefix for exports, for example "archive-seance". */
  exportName?: string;
  /** Override for tests. */
  download?: (blob: Blob, filename: string) => void;
}

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

export function SettingsDialog({
  open,
  onOpenChange,
  onAfterWipe,
  exportName = "seance",
  download = defaultDownload,
}: SettingsDialogProps) {
  const { config, save, build, storage, reload, isMock, error: configError } = useProviderMode();
  const [form, setForm] = useState<Form>(() => formFrom(config));
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const groupName = useId();
  const wasOpen = useRef(false);
  const dirty = useRef(false);
  const wipeTrigger = useRef<HTMLButtonElement>(null);
  const wipeCancel = useRef<HTMLButtonElement>(null);

  // Reset when the dialog opens. While it stays open, only fill in settings that finish
  // loading, and only if the user has not started editing. Status messages are never wiped.
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!open) return;
    if (opening) {
      dirty.current = false;
      setConfirmWipe(false);
      setStatus(
        configError
          ? { tone: "error", text: `Saved settings could not be used: ${configError}` }
          : null,
      );
    }
    if (opening || !dirty.current) setForm(formFrom(config));
  }, [open, config, configError]);

  useEffect(() => {
    if (confirmWipe) wipeCancel.current?.focus();
  }, [confirmWipe]);

  const set = (patch: Partial<Form>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
    setStatus(null);
  };
  const kind: Kind | null = form.choice === "demo" ? null : form.choice;
  const setKey = (v: string) =>
    kind && kind !== "ollama" && set({ keys: { ...form.keys, [kind]: v } });
  const setModel = (v: string) => kind && set({ models: { ...form.models, [kind]: v } });
  const cancelWipe = () => {
    setConfirmWipe(false);
    setTimeout(() => wipeTrigger.current?.focus(), 0);
  };
  const invalid = validate(form);

  const onSave = async () => {
    if (invalid) return setStatus({ tone: "error", text: invalid });
    try {
      await save(configFrom(form));
      setStatus({
        tone: "ok",
        text:
          form.choice === "demo"
            ? "Back in demo mode. Your key was removed."
            : "Saved. The agent now uses this model.",
      });
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const onTest = async () => {
    const next = configFrom(form);
    if (!next || invalid)
      return setStatus({ tone: "error", text: invalid ?? "Pick a real provider to test." });
    setTesting(true);
    setStatus({ tone: "info", text: "Testing…" });
    try {
      const reply = await build(next).complete({
        messages: [{ role: "user", content: "Reply with the single word OK." }],
        tools: [],
        signal: AbortSignal.timeout(20_000),
      });
      const said = reply.text.trim().slice(0, 80) || "(empty reply)";
      setStatus({ tone: "ok", text: `Connected. The model replied: ${said}` });
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const onExport = async () => {
    const day = new Date().toISOString().slice(0, 10);
    download(await storage.exportAll(), `${exportName}-export-${day}.json`);
    setStatus({ tone: "ok", text: "Export downloaded. It does not include your API key." });
  };

  const onWipe = async () => {
    await storage.wipe();
    await reload();
    onAfterWipe?.();
    setConfirmWipe(false);
    setForm(EMPTY);
    setStatus({ tone: "ok", text: "All local data was deleted." });
  };

  const choice = CHOICES.find((c) => c.value === form.choice);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-2xl shadow-black/60">
          <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            Everything here is stored only in this browser.
          </Dialog.Description>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted">
              Model provider
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CHOICES.map((c) => (
                <label
                  key={c.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    form.choice === c.value
                      ? "border-ecto bg-raised text-fg"
                      : "border-line text-muted hover:border-muted",
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={c.value}
                    checked={form.choice === c.value}
                    onChange={() => set({ choice: c.value })}
                    className="accent-[var(--color-ecto)]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {choice && <p className="mt-2 text-xs text-muted">{choice.note}</p>}
          </fieldset>

          {form.choice !== "demo" && (
            <div className="mt-5 space-y-4">
              {form.choice === "openai-compatible" && (
                <Field label="Base URL">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.baseUrl}
                      onChange={(e) => set({ baseUrl: e.target.value })}
                      spellCheck={false}
                    />
                  )}
                </Field>
              )}
              {form.choice !== "ollama" && (
                <Field
                  label="API key"
                  hint="Saved in this browser's IndexedDB. Sent only to the provider above. Never exported."
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={kind && kind !== "ollama" ? form.keys[kind] : ""}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  )}
                </Field>
              )}
              {form.choice === "ollama" && (
                <Field label="Host" hint="Leave empty for http://localhost:11434.">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.host}
                      placeholder="http://localhost:11434"
                      onChange={(e) => set({ host: e.target.value })}
                      spellCheck={false}
                    />
                  )}
                </Field>
              )}
              <Field label="Model" hint="The exact model name your provider lists.">
                {(id) => (
                  <Input
                    id={id}
                    value={kind ? form.models[kind] : ""}
                    onChange={(e) => setModel(e.target.value)}
                    spellCheck={false}
                  />
                )}
              </Field>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={onSave}>
              Save
            </Button>
            {form.choice !== "demo" && (
              <Button onClick={onTest} disabled={testing}>
                Test connection
              </Button>
            )}
            <span className="ml-auto text-xs text-muted">
              {isMock ? "Now: demo mode" : "Now: real model"}
            </span>
          </div>
          <p
            role="status"
            className={cn(
              "mt-3 min-h-5 text-sm",
              status?.tone === "error"
                ? "text-blood"
                : status?.tone === "ok"
                  ? "text-ecto"
                  : "text-muted",
            )}
          >
            {status?.text}
          </p>

          <section aria-labelledby={`${groupName}-data`} className="mt-6 border-t border-line pt-5">
            <h3
              id={`${groupName}-data`}
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Your data
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={onExport}>Export all data</Button>
              {!confirmWipe && (
                <Button
                  ref={wipeTrigger}
                  variant="ghost"
                  className="text-blood hover:text-blood"
                  onClick={() => setConfirmWipe(true)}
                >
                  Delete all local data…
                </Button>
              )}
            </div>
            {confirmWipe && (
              <div
                role="alert"
                className="mt-3 rounded-md border border-blood/60 bg-raised p-3 text-sm"
              >
                <p>
                  This permanently deletes everything this app stored in this browser, including
                  your saved key. Export first if you want a copy.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" size="sm" onClick={onWipe}>
                    Delete everything
                  </Button>
                  <Button ref={wipeCancel} size="sm" onClick={cancelWipe}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-3 top-3"
              aria-label="Close settings"
            >
              ✕
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
