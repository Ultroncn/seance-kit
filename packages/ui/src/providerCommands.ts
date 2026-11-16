import { useMemo } from "react";
import type { PaletteCommand } from "./CommandPalette";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { useProviderMode } from "./ProviderMode";

/** Palette commands to switch providers. Apps add these to their command list. */
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
