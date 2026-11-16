import * as Dialog from "@radix-ui/react-dialog";
import {
  PROVIDER_PRESETS,
  listModels,
  presetById,
  type ModelInfo,
  type ProviderConfig,
  type ProviderKind,
  type ProviderPreset,
  type ProviderProfile,
} from "@seance/llm";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Button, Input } from "./primitives";
import { useProviderMode } from "./ProviderMode";

type Kit = (typeof kitMessages)["en"];

const ANTHROPIC_DEFAULT = "https://api.anthropic.com";
const OLLAMA_DEFAULT = "http://localhost:11434";

/** The editor's state. A key typed for one vendor is cleared when the vendor changes. */
interface Form {
  /** Null while adding a new profile. */
  id: string | null;
  preset: string;
  name: string;
  protocol: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const fallbackPreset = (kind: ProviderKind) =>
  kind === "anthropic" ? "custom-anthropic" : kind === "ollama" ? "ollama" : "custom-openai";

export const presetLabel = (p: ProviderPreset, t: Kit) => t.customNames[p.id] ?? p.name;

function formForPreset(preset: ProviderPreset, t: Kit, taken: string[]): Form {
  const base = presetLabel(preset, t);
  let name = base;
  for (let i = 2; taken.includes(name); i++) name = `${base} ${i}`;
  return {
    id: null,
    preset: preset.id,
    name,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: "",
  };
}

function formFromProfile(p: ProviderProfile): Form {
  const c = p.config;
  const preset = presetById(p.preset) ? p.preset : fallbackPreset(c.kind);
  return {
    id: p.id,
    preset,
    name: p.name,
    protocol: c.kind,
    baseUrl:
      c.kind === "anthropic"
        ? (c.baseUrl ?? ANTHROPIC_DEFAULT)
        : c.kind === "ollama"
          ? (c.host ?? OLLAMA_DEFAULT)
          : c.baseUrl,
    apiKey: c.kind === "ollama" ? "" : c.apiKey,
    model: c.model,
  };
}

function configFrom(f: Form): ProviderConfig {
  const url = f.baseUrl.trim().replace(/\/+$/, "");
  const key = f.apiKey.trim();
  const model = f.model.trim();
  switch (f.protocol) {
    case "anthropic":
      return {
        kind: "anthropic",
        apiKey: key,
        model,
        ...(url && url !== ANTHROPIC_DEFAULT ? { baseUrl: url } : {}),
      };
    case "openai-compatible":
      return { kind: "openai-compatible", baseUrl: url, apiKey: key, model };
    case "ollama":
      return { kind: "ollama", model, ...(url && url !== OLLAMA_DEFAULT ? { host: url } : {}) };
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
  if (url.protocol === "https:") return url.hostname !== "";
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

const needsKey = (f: Form) => f.protocol !== "ollama" && (presetById(f.preset)?.needsKey ?? true);

/** Ready-to-save settings, or a plain reason why not. */
function validate(f: Form, t: Kit): string | null {
  if (needsKey(f) && f.apiKey.trim() === "") return t.errKey;
  if (f.model.trim() === "") return t.errModel;
  if (f.protocol === "ollama") return isAllowedEndpoint(f.baseUrl) ? null : t.errHost;
  return isAllowedEndpoint(f.baseUrl) ? null : t.errBaseUrl;
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

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
  /** Override for tests. Defaults to `listModels` from `@seance/llm`. */
  loadModels?: (config: ProviderConfig) => Promise<ModelInfo[]>;
}

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

const REGIONS = ["global", "china", "local", "custom"] as const;
/** The "type it yourself" entry of the model list. Not a valid model id. */
const OTHER = "\u0000other";

export function SettingsDialog({
  open,
  onOpenChange,
  onAfterWipe,
  exportName = "seance",
  download = defaultDownload,
  loadModels = (c) => listModels(c),
}: SettingsDialogProps) {
  const mode = useProviderMode();
  const { profiles, activeId, build, storage, reload, isMock, error: configError } = mode;
  const t = useT(kitMessages);
  const [form, setForm] = useState<Form | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  /** Type a model name instead of picking from the loaded list. */
  const [manual, setManual] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const groupName = useId();
  const wasOpen = useRef(false);
  const wipeTrigger = useRef<HTMLButtonElement>(null);
  const wipeCancel = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const editorFirst = useRef<HTMLSelectElement>(null);

  // Reset when the dialog opens. Status messages are never wiped while it stays open.
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening) return;
    setConfirmWipe(false);
    setForm(null);
    setModels([]);
    setManual(false);
    setStatus(configError ? { tone: "error", text: t.savedUnusable(configError) } : null);
    // t is read only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configError]);

  useEffect(() => {
    if (confirmWipe) wipeCancel.current?.focus();
  }, [confirmWipe]);

  const editing = form !== null;
  useEffect(() => {
    if (editing) editorFirst.current?.focus();
  }, [editing]);

  const set = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setStatus(null);
  };
  const pickPreset = (id: string) => {
    const preset = presetById(id);
    if (!form || !preset) return;
    const fresh = formForPreset(
      preset,
      t,
      profiles.filter((p) => p.id !== form.id).map((p) => p.name),
    );
    // A new vendor never inherits the previous vendor's key.
    setForm({ ...fresh, id: form.id });
    setModels([]);
    setManual(false);
    setStatus(null);
  };
  const startAdd = () => {
    setForm(
      formForPreset(
        PROVIDER_PRESETS[0] as ProviderPreset,
        t,
        profiles.map((p) => p.name),
      ),
    );
    setModels([]);
    setManual(false);
    setStatus(null);
  };
  const closeEditor = () => {
    setForm(null);
    setTimeout(() => addButton.current?.focus(), 0);
  };

  const fail = (err: unknown) =>
    setStatus({ tone: "error", text: err instanceof Error ? err.message : String(err) });

  const onActivate = async (id: string | null) => {
    try {
      await mode.activate(id);
      const name = profiles.find((p) => p.id === id)?.name;
      setStatus({ tone: "ok", text: name ? t.nowUsing(name) : t.demoOn });
    } catch (err) {
      fail(err);
    }
  };
  const onDelete = async (p: ProviderProfile) => {
    try {
      await mode.removeProfile(p.id);
      if (form?.id === p.id) setForm(null);
      setStatus({ tone: "ok", text: t.deleted(p.name) });
      setTimeout(() => addButton.current?.focus(), 0);
    } catch (err) {
      fail(err);
    }
  };

  const invalid = form ? validate(form, t) : null;
  const onSave = async () => {
    if (!form) return;
    if (invalid) return setStatus({ tone: "error", text: invalid });
    const others = profiles.filter((p) => p.id !== form.id).map((p) => p.name);
    // Names label the palette commands and the model picker, so they must stay unique.
    let name = form.name.trim() || presetLabel(presetById(form.preset) as ProviderPreset, t);
    for (let i = 2, base = name; others.includes(name); i++) name = `${base} ${i}`;
    const before = profiles.find((p) => p.id === form.id);
    const config = configFrom(form);
    // Keep the reasoning level while the model stays the same.
    const kept =
      before?.config.model === config.model &&
      before.preset === form.preset &&
      "reasoning" in before.config &&
      before.config.reasoning &&
      config.kind !== "ollama"
        ? { reasoning: before.config.reasoning }
        : {};
    const profile: ProviderProfile = {
      id: form.id ?? newId(),
      name,
      preset: form.preset,
      config: { ...config, ...kept } as ProviderConfig,
      ...(models.length > 0 ? { models } : {}),
    };
    try {
      await mode.saveProfile(profile, true);
      setForm(null);
      setStatus({ tone: "ok", text: t.nowUsing(profile.name) });
      setTimeout(() => addButton.current?.focus(), 0);
    } catch (err) {
      fail(err);
    }
  };
  const onTest = async () => {
    if (!form) return;
    if (invalid) return setStatus({ tone: "error", text: invalid });
    setBusy(true);
    setStatus({ tone: "info", text: t.testing });
    try {
      const reply = await build(configFrom(form)).complete({
        messages: [{ role: "user", content: "Reply with the single word OK." }],
        tools: [],
        signal: AbortSignal.timeout(20_000),
      });
      const said = reply.text.trim().slice(0, 80) || t.emptyReply;
      setStatus({ tone: "ok", text: t.connected(said) });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  const onLoadModels = async () => {
    if (!form) return;
    if (needsKey(form) && form.apiKey.trim() === "")
      return setStatus({ tone: "error", text: t.errKey });
    if (!isAllowedEndpoint(form.baseUrl))
      return setStatus({
        tone: "error",
        text: form.protocol === "ollama" ? t.errHost : t.errBaseUrl,
      });
    setBusy(true);
    setStatus({ tone: "info", text: t.loadingModels });
    try {
      const ids = await loadModels(configFrom(form));
      setModels(ids);
      setManual(ids.length === 0);
      setStatus(
        ids.length
          ? { tone: "ok", text: t.modelsLoaded(ids.length) }
          : { tone: "info", text: t.noModels },
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    const day = new Date().toISOString().slice(0, 10);
    download(await storage.exportAll(), `${exportName}-export-${day}.json`);
    setStatus({ tone: "ok", text: t.exported });
  };
  const cancelWipe = () => {
    setConfirmWipe(false);
    setTimeout(() => wipeTrigger.current?.focus(), 0);
  };
  const onWipe = async () => {
    await storage.wipe();
    await reload();
    onAfterWipe?.();
    setConfirmWipe(false);
    setForm(null);
    setStatus({ tone: "ok", text: t.wiped });
  };

  const preset = form ? presetById(form.preset) : undefined;
  const custom = preset?.region === "custom";
  const choice = (selected: boolean) =>
    cn(
      "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
      selected ? "border-ecto bg-raised text-fg" : "border-line text-muted hover:border-muted",
    );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-2xl shadow-black/60">
          <Dialog.Title className="text-lg font-semibold">{t.settings}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            {t.settingsIntro}
          </Dialog.Description>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t.provider}
            </legend>
            <ul className="mt-3 space-y-2">
              <li>
                <label className={choice(activeId === null)}>
                  <input
                    type="radio"
                    name={groupName}
                    checked={activeId === null}
                    onChange={() => void onActivate(null)}
                    className="accent-[var(--color-ecto)]"
                  />
                  <span className="flex flex-col">
                    <span>{t.demoChoice}</span>
                    <span className="text-xs text-muted">{t.demoChoiceNote}</span>
                  </span>
                </label>
              </li>
              {profiles.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <label className={choice(activeId === p.id)}>
                    <input
                      type="radio"
                      name={groupName}
                      checked={activeId === p.id}
                      onChange={() => void onActivate(p.id)}
                      className="accent-[var(--color-ecto)]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{p.name}</span>
                      <span className="truncate font-mono text-[11px] text-muted">
                        {t.protocols[p.config.kind]} · {p.config.model}
                      </span>
                    </span>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t.editNamed(p.name)}
                    onClick={() => {
                      setForm(formFromProfile(p));
                      setModels(p.models ?? []);
                      setManual(!(p.models ?? []).some((m) => m.id === p.config.model));
                      setStatus(null);
                    }}
                  >
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-blood hover:text-blood"
                    aria-label={t.deleteNamed(p.name)}
                    onClick={() => void onDelete(p)}
                  >
                    {t.delete}
                  </Button>
                </li>
              ))}
            </ul>
            {!form && (
              <Button ref={addButton} className="mt-3" onClick={startAdd}>
                {t.addProvider}
              </Button>
            )}
          </fieldset>

          {form && (
            <section
              aria-label={form.id ? t.editNamed(form.name) : t.addProvider}
              className="mt-4 space-y-4 rounded-lg border border-line bg-bg/40 p-4"
            >
              <Field label={t.vendor}>
                {(id) => (
                  <select
                    ref={editorFirst}
                    id={id}
                    value={form.preset}
                    onChange={(e) => pickPreset(e.target.value)}
                    className="h-9 w-full rounded-md border border-edge bg-surface px-2 text-sm text-fg"
                  >
                    {REGIONS.map((r) => (
                      <optgroup key={r} label={t.regions[r]}>
                        {PROVIDER_PRESETS.filter((p) => p.region === r).map((p) => (
                          <option key={p.id} value={p.id}>
                            {presetLabel(p, t)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </Field>
              {preset && (
                <p
                  className={cn(
                    "text-xs",
                    preset.access === "blocked"
                      ? "text-blood"
                      : preset.access === "ok"
                        ? "text-ecto"
                        : "text-candle",
                  )}
                >
                  {t.access[preset.access]}
                  {preset.keyUrl && (
                    <>
                      {" "}
                      <a
                        href={preset.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fg underline underline-offset-2"
                      >
                        {t.getKey} ↗
                      </a>
                    </>
                  )}
                </p>
              )}
              <Field label={t.profileName}>
                {(id) => (
                  <Input
                    id={id}
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                )}
              </Field>
              {custom ? (
                <Field label={t.protocol}>
                  {(id) => (
                    <select
                      id={id}
                      value={form.protocol}
                      onChange={(e) => set({ protocol: e.target.value as ProviderKind })}
                      className="h-9 w-full rounded-md border border-edge bg-surface px-2 text-sm text-fg"
                    >
                      <option value="openai-compatible">{t.protocols["openai-compatible"]}</option>
                      <option value="anthropic">{t.protocols.anthropic}</option>
                    </select>
                  )}
                </Field>
              ) : (
                <p className="text-xs text-muted">{t.protocolIs(t.protocols[form.protocol])}</p>
              )}
              <Field
                label={form.protocol === "ollama" ? t.host : t.baseUrl}
                hint={form.protocol === "ollama" ? t.ollamaHint : undefined}
              >
                {(id) => (
                  <Input
                    id={id}
                    value={form.baseUrl}
                    spellCheck={false}
                    onChange={(e) => set({ baseUrl: e.target.value })}
                  />
                )}
              </Field>
              {form.protocol !== "ollama" && (
                <Field label={needsKey(form) ? t.apiKey : t.apiKeyOptional} hint={t.apiKeyHint}>
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={form.apiKey}
                      onChange={(e) => set({ apiKey: e.target.value })}
                    />
                  )}
                </Field>
              )}
              <Field label={t.model} hint={t.modelHint}>
                {(id) => (
                  <div className="flex gap-2">
                    {models.length > 0 && !manual ? (
                      <select
                        id={id}
                        value={form.model}
                        onChange={(e) =>
                          e.target.value === OTHER
                            ? setManual(true)
                            : set({ model: e.target.value })
                        }
                        className="h-9 min-w-0 flex-1 rounded-md border border-edge bg-surface px-2 text-sm text-fg"
                      >
                        <option value="" disabled>
                          {t.chooseModel}
                        </option>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                        <option value={OTHER}>{t.otherModel}</option>
                      </select>
                    ) : (
                      <Input
                        id={id}
                        value={form.model}
                        spellCheck={false}
                        placeholder={t.modelPlaceholder}
                        className="flex-1"
                        onChange={(e) => set({ model: e.target.value })}
                      />
                    )}
                    <Button size="sm" onClick={() => void onLoadModels()} disabled={busy}>
                      {t.loadModels}
                    </Button>
                  </div>
                )}
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => void onSave()}>
                  {t.saveAndUse}
                </Button>
                <Button onClick={() => void onTest()} disabled={busy}>
                  {t.testConnection}
                </Button>
                <Button variant="ghost" onClick={closeEditor}>
                  {t.cancel}
                </Button>
              </div>
            </section>
          )}

          <div className="mt-4 flex items-center">
            <span className="ml-auto text-xs text-muted">{isMock ? t.nowDemo : t.nowReal}</span>
          </div>
          <p
            role="status"
            className={cn(
              "mt-2 min-h-5 text-sm",
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
              {t.yourData}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void onExport()}>{t.exportAll}</Button>
              {!confirmWipe && (
                <Button
                  ref={wipeTrigger}
                  variant="ghost"
                  className="text-blood hover:text-blood"
                  onClick={() => setConfirmWipe(true)}
                >
                  {t.deleteAll}
                </Button>
              )}
            </div>
            {confirmWipe && (
              <div
                role="alert"
                className="mt-3 rounded-md border border-blood/60 bg-raised p-3 text-sm"
              >
                <p>{t.deleteWarning}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" size="sm" onClick={() => void onWipe()}>
                    {t.deleteEverything}
                  </Button>
                  <Button ref={wipeCancel} size="sm" onClick={cancelWipe}>
                    {t.cancel}
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
              aria-label={t.closeSettings}
            >
              ✕
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
