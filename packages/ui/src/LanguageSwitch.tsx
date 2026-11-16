import { cn } from "./cn";
import { LOCALES, setLocale, useLocale, useT } from "./i18n";
import { kitMessages } from "./messages";

/**
 * EN / 中文 segmented switch. Each label is written in its own language, so a reader who
 * cannot read the current one still finds theirs. The choice is kept per origin, so the
 * landing page and both apps switch together.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT(kitMessages);
  return (
    <div
      role="group"
      aria-label={t.language}
      className={cn("inline-flex rounded-md border border-line p-0.5 text-xs", className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.lang}
          aria-pressed={locale === l.id}
          onClick={() => setLocale(l.id)}
          className={cn(
            "rounded px-2 py-0.5 font-medium",
            locale === l.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
