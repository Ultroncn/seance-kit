import { useId, useMemo } from "react";
import type { PaletteCommand } from "./CommandPalette";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { useProviderMode } from "./ProviderMode";

/**
 * Switch between demo mode and saved providers from the header, like CC Switch. Hidden until a
 * provider is saved, because there is nothing to switch to before that.
 */
export function ProviderSwitch() {
  const { profiles, activeId, activate } = useProviderMode();
  const t = useT(kitMessages);
  const id = useId();
  if (profiles.length === 0) return null;
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {t.modelSwitch}
      </label>
      <select
        id={id}
        value={activeId ?? ""}
        onChange={(e) => void activate(e.target.value || null)}
        className="h-8 max-w-44 truncate rounded-md border border-edge bg-surface px-2 text-xs text-fg"
      >
        <option value="">{t.demoChoice}</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </>
  );
}

/** Palette commands for the same switch. Apps add these to their command list. */
export function useProviderCommands(): PaletteCommand[] {
  const { profiles, activeId, activate } = useProviderMode();
  const t = useT(kitMessages);
  return useMemo(
    () => [
      {
        id: "provider-demo",
        label: t.useDemo,
        group: t.groupModel,
        keywords: ["demo", "mock", "scripted"],
        disabled: activeId === null,
        onSelect: () => void activate(null),
      },
      ...profiles.map((p) => ({
        id: `provider-${p.id}`,
        label: t.useNamed(p.name),
        group: t.groupModel,
        keywords: ["model", "provider", "switch", p.config.model],
        disabled: activeId === p.id,
        onSelect: () => void activate(p.id),
      })),
    ],
    [profiles, activeId, activate, t],
  );
}
