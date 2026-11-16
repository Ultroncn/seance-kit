import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Tooltip } from "./primitives";
import { useProviderMode } from "./ProviderMode";

/**
 * Persistent "Demo mode" badge (R3.4). Shown whenever the agent's provider is the scripted
 * Mock, on every screen that runs the agent. It cannot be dismissed. Clicking it opens settings.
 */
export function DemoBadge({ onClick }: { onClick?: () => void }) {
  const { isMock } = useProviderMode();
  const t = useT(kitMessages);
  if (!isMock) return null;
  return (
    <Tooltip content={t.demoTooltip}>
      <button
        type="button"
        onClick={onClick}
        data-testid="demo-badge"
        className="inline-flex items-center gap-1.5 rounded-full border border-candle/50 bg-candle/10 px-2.5 py-1 text-xs font-semibold text-candle hover:bg-candle/20"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-candle" />
        {t.demoMode}
        <span className="sr-only">{t.demoSr}</span>
      </button>
    </Tooltip>
  );
}
