import { useSyncExternalStore } from "react";

/**
 * A small typed i18n layer. Each package keeps an English dictionary, and the Chinese one must
 * have exactly the same keys and parameter types, or `tsc` fails. Messages are strings or
 * functions, so parameters are typed too. Works in React (`useT`) and in plain code (`getLocale`).
 */

export type Locale = "en" | "zh";

export const LOCALES: readonly { id: Locale; label: string; lang: string }[] = [
  { id: "en", label: "EN", lang: "en" },
  { id: "zh", label: "中文", lang: "zh-CN" },
];

const STORAGE_KEY = "seance.locale";

function detect(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // Storage can be blocked. Fall back to the browser language.
  }
  return (navigator.languages?.[0] ?? navigator.language ?? "en").toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
}

let current: Locale = detect();
const listeners = new Set<() => void>();

function applyToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = LOCALES.find((l) => l.id === locale)?.lang ?? "en";
}
applyToDocument(current);

if (typeof window !== "undefined") {
  // Another tab or app on this origin switched language.
  window.addEventListener("storage", (e) => {
    if (
      e.key === STORAGE_KEY &&
      (e.newValue === "en" || e.newValue === "zh") &&
      e.newValue !== current
    ) {
      current = e.newValue;
      applyToDocument(current);
      listeners.forEach((l) => l());
    }
  });
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not saved, but still applied for this page.
  }
  applyToDocument(locale);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current locale, re-rendering when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => "en");
}

/** English messages define the shape. Every other locale must match it exactly. */
export type Messages<T> = Record<Locale, T>;

export function defineMessages<T extends Record<string, unknown>>(
  en: T,
  zh: NoInfer<T>,
): Messages<T> {
  return { en, zh };
}

/** Messages for the current locale, re-rendering on change. */
export function useT<T>(messages: Messages<T>): T {
  return messages[useLocale()];
}

/** Messages for the current locale, for code outside React (demo scripts, prompts). */
export function tNow<T>(messages: Messages<T>): T {
  return messages[getLocale()];
}

const langOf = (locale: Locale) => LOCALES.find((l) => l.id === locale)?.lang ?? "en";

/** Dates in the reader's language. All dates in the apps are stored as ISO in UTC. */
export function formatDate(
  iso: string,
  style: "month" | "day" | "full",
  locale: Locale = getLocale(),
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions =
    style === "month"
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : style === "day"
        ? { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
        : {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            timeZoneName: "short",
          };
  return new Intl.DateTimeFormat(langOf(locale), options).format(d);
}

/** Pick the English singular or plural; Chinese has one form. */
export const plural = (n: number, one: string, many: string) =>
  new Intl.PluralRules("en").select(n) === "one" ? one : many;
/** A real model is told which language the reader uses. The rest of the system prompt stays English. */
export function withReplyLanguage(system: string, locale: Locale = getLocale()): string {
  return locale === "zh"
    ? `${system}\n- The user reads Simplified Chinese. Write your messages to the user, and notes only they read such as summaries, in Simplified Chinese. Email drafts and anything written for someone else stay in the language of the conversation they belong to. Keep ids, tool names and categories exactly as the tools define them.`
    : system;
}
