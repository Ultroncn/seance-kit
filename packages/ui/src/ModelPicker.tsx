import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  reasoningOptions,
  type ProviderConfig,
  type ProviderProfile,
  type ReasoningLevel,
} from "@seance/llm";
import { cn } from "./cn";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { useProviderMode } from "./ProviderMode";

const DEMO = "demo";
const key = (profileId: string, model: string) => `${profileId}\u0000${model}`;

/** A saved provider's models: the loaded list, or just the one it uses. */
const modelsOf = (p: ProviderProfile) =>
  p.models && p.models.length > 0 ? p.models.map((m) => m.id) : [p.config.model];

const levelOf = (c: ProviderConfig) => (c.kind === "ollama" ? undefined : c.reasoning?.level);

function optionsFor(p: ProviderProfile | undefined) {
  if (!p || p.config.kind === "ollama") return null;
  const model = p.config.model;
  return reasoningOptions(
    p.preset,
    model,
    p.models?.find((m) => m.id === model),
  );
}

/** The same profile with another model or level. A level the new model lacks is dropped. */
export function withModelChoice(
  p: ProviderProfile,
  model: string,
  level?: ReasoningLevel | null,
): ProviderProfile {
  if (p.config.kind === "ollama") return { ...p, config: { ...p.config, model } };
  const { reasoning, ...rest } = p.config;
  const next = { ...p, config: { ...rest, model } as ProviderConfig };
  const opts = optionsFor(next);
  const want = level === undefined ? reasoning?.level : (level ?? undefined);
  return opts && want && opts.levels.includes(want)
    ? {
        ...next,
        config: { ...next.config, reasoning: { style: opts.style, level: want } } as ProviderConfig,
      }
    : next;
}

const item =
  "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-raised";
const panel =
  "z-50 min-w-56 rounded-lg border border-line bg-surface p-1 shadow-xl shadow-black/50";
const heading = "px-2 pb-1 pt-2 text-[11px] font-semibold text-muted";

function Dot() {
  return (
    <Menu.ItemIndicator className="ml-auto">
      <span aria-hidden className="block size-1.5 rounded-full bg-ecto" />
    </Menu.ItemIndicator>
  );
}

/**
 * Choose the model and its reasoning level next to the prompt box. Models are grouped under each
 * saved provider; reasoning levels are the ones the chosen model offers, or none.
 */
export function ModelPicker({ onManage }: { onManage?: () => void }) {
  const { profiles, activeId, activate, saveProfile } = useProviderMode();
  const t = useT(kitMessages);
  const active = profiles.find((p) => p.id === activeId);
  const opts = optionsFor(active);
  const level = active ? levelOf(active.config) : undefined;
  const current = active ? key(active.id, active.config.model) : DEMO;
  const summary = active
    ? [active.name, active.config.model, level ? t.levels[level] : null].filter(Boolean).join(" · ")
    : t.demoChoice;

  const pickModel = (value: string) => {
    if (value === DEMO) return void activate(null);
    const [id, model] = value.split("\u0000");
    const p = profiles.find((x) => x.id === id);
    if (p && model !== undefined) void saveProfile(withModelChoice(p, model), true);
  };
  const pickLevel = (value: string) => {
    if (active)
      void saveProfile(
        withModelChoice(active, active.config.model, (value || null) as ReasoningLevel | null),
        true,
      );
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${t.modelMenu}: ${summary}`}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-ecto"
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-ecto" : "bg-candle")}
        />
        <span className="truncate">{summary}</span>
        <span aria-hidden>▾</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side="top" align="start" sideOffset={6} className={panel}>
          <Menu.Sub>
            <Menu.SubTrigger className={item}>
              {t.menuModel}
              <span className="ml-auto max-w-40 truncate text-xs text-muted">
                {active ? active.config.model : t.demoChoice}
              </span>
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Menu.SubTrigger>
            <Menu.Portal>
              <Menu.SubContent sideOffset={6} className={cn(panel, "max-h-[60vh] overflow-y-auto")}>
                <Menu.RadioGroup value={current} onValueChange={pickModel}>
                  <Menu.Label className={heading}>{t.demoGroup}</Menu.Label>
                  <Menu.RadioItem value={DEMO} className={item}>
                    {t.demoChoice}
                    <Dot />
                  </Menu.RadioItem>
                  {profiles.map((p) => (
                    <Menu.Group key={p.id}>
                      <Menu.Separator className="my-1 h-px bg-line" />
                      <Menu.Label className={heading}>{p.name}</Menu.Label>
                      {modelsOf(p).map((m) => (
                        <Menu.RadioItem
                          key={m}
                          value={key(p.id, m)}
                          className={cn(item, "font-mono text-xs")}
                        >
                          {m}
                          <Dot />
                        </Menu.RadioItem>
                      ))}
                    </Menu.Group>
                  ))}
                </Menu.RadioGroup>
              </Menu.SubContent>
            </Menu.Portal>
          </Menu.Sub>
          <Menu.Sub>
            <Menu.SubTrigger className={item} disabled={!opts}>
              {t.menuReasoning}
              <span className="ml-auto text-xs text-muted">
                {!opts ? t.notSupported : level ? t.levels[level] : t.levelDefault}
              </span>
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Menu.SubTrigger>
            <Menu.Portal>
              <Menu.SubContent sideOffset={6} className={panel}>
                <Menu.RadioGroup value={level ?? ""} onValueChange={pickLevel}>
                  <Menu.RadioItem value="" className={item}>
                    {t.levelDefault}
                    <Dot />
                  </Menu.RadioItem>
                  {opts?.levels.map((l) => (
                    <Menu.RadioItem key={l} value={l} className={item}>
                      {t.levels[l]}
                      <Dot />
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.SubContent>
            </Menu.Portal>
          </Menu.Sub>
          {!opts && active && (
            <p className="px-2 pb-1 text-[11px] text-muted">{t.notSupportedNote}</p>
          )}
          {onManage && (
            <>
              <Menu.Separator className="my-1 h-px bg-line" />
              <Menu.Item className={item} onSelect={onManage}>
                {t.manageProviders}
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
