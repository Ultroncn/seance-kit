import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  reasoningOptions,
  type ProviderConfig,
  type ProviderProfile,
  type ReasoningLevel,
} from "@seance/llm";
import { Check as CheckIcon, ChevronDown, Settings2 } from "lucide-react";
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
  "flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm text-fg outline-none data-[disabled]:cursor-default data-[disabled]:text-disabled data-[highlighted]:bg-surface-3";
const heading = "px-2 pb-1 pt-2 text-xs font-medium text-muted";

function Check() {
  return (
    <Menu.ItemIndicator className="ml-auto text-accent">
      <CheckIcon aria-hidden className="size-4" />
    </Menu.ItemIndicator>
  );
}

/**
 * The model and its reasoning level, chosen from the composer. One menu, no submenus: models
 * grouped under each saved provider, then the levels the chosen model offers.
 */
export function ModelPicker({ onManage }: { onManage?: () => void }) {
  const { profiles, activeId, activate, saveProfile } = useProviderMode();
  const t = useT(kitMessages);
  const active = profiles.find((p) => p.id === activeId);
  const opts = optionsFor(active);
  const level = active ? levelOf(active.config) : undefined;
  const current = active ? key(active.id, active.config.model) : DEMO;
  const summary = active
    ? [active.config.model, level ? t.levels[level] : null].filter(Boolean).join(" · ")
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
        className="inline-flex h-7 min-w-0 max-w-[16rem] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-2 transition-colors duration-100 hover:bg-surface-3 hover:text-fg data-[state=open]:bg-surface-3"
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-accent" : "bg-warn")}
        />
        <span className="truncate">{summary}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 max-h-[min(28rem,70vh)] w-72 overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-popover"
        >
          <Menu.Label className={heading}>{t.menuModel}</Menu.Label>
          <Menu.RadioGroup value={current} onValueChange={pickModel}>
            <Menu.RadioItem value={DEMO} className={item}>
              <span className="truncate">{t.demoChoice}</span>
              <Check />
            </Menu.RadioItem>
            {profiles.map((p) => (
              <Menu.Group key={p.id}>
                <Menu.Label className={cn(heading, "pt-2.5")}>{p.name}</Menu.Label>
                {modelsOf(p).map((m) => (
                  <Menu.RadioItem key={m} value={key(p.id, m)} className={item}>
                    <span className="truncate font-mono text-meta">{m}</span>
                    <Check />
                  </Menu.RadioItem>
                ))}
              </Menu.Group>
            ))}
          </Menu.RadioGroup>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Label className={heading}>{t.menuReasoning}</Menu.Label>
          {opts ? (
            <Menu.RadioGroup value={level ?? ""} onValueChange={pickLevel}>
              <Menu.RadioItem value="" className={item}>
                {t.levelDefault}
                <Check />
              </Menu.RadioItem>
              {opts.levels.map((l) => (
                <Menu.RadioItem key={l} value={l} className={item}>
                  {t.levels[l]}
                  <Check />
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          ) : (
            <p className="px-2 pb-2 text-meta text-muted">
              {active ? t.notSupportedNote : t.reasoningDemoNote}
            </p>
          )}
          {onManage && (
            <>
              <Menu.Separator className="my-1 h-px bg-line" />
              <Menu.Item className={item} onSelect={onManage}>
                <Settings2 aria-hidden className="size-4 text-muted" />
                {t.manageProviders}
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
