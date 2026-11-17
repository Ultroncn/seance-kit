import { BrandMark, LanguageSwitch, useLocale } from "@seance/ui";
import { ArrowRight } from "lucide-react";
import type { siteMessages } from "./messages";

type SiteText = (typeof siteMessages)["en"];
export const REPO = "https://github.com/Ultroncn/seance-kit";

/** Site navigation: wordmark, two links, language, and one call to action. */
export function Nav({ t }: { t: SiteText }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-6 px-6">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold text-fg">
          <BrandMark />
          Séance Kit
        </a>
        <nav aria-label={t.nav} className="ml-auto flex items-center gap-1 text-sm text-fg-2">
          <a
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-raised hover:text-fg"
            href="/kit/"
          >
            {t.uiKit}
          </a>
          <a
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-raised hover:text-fg"
            href={REPO}
          >
            GitHub
          </a>
          <LanguageSwitch className="ml-2" />
        </nav>
      </div>
    </header>
  );
}

/** The pitch, centered, then the product itself in a window frame. */
export function Hero({ t }: { t: SiteText }) {
  const lang = useLocale();
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--color-accent-solid)_22%,transparent),transparent)]"
      />
      <div className="relative mx-auto max-w-[1120px] px-6 pb-20 pt-24 text-center">
        <p className="inline-flex h-7 items-center rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg-2">
          {t.eyebrow}
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold text-fg [word-break:keep-all] sm:text-6xl">
          {t.headline}
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-lg leading-relaxed text-fg-2">{t.lede}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a
            href="/archive/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-solid px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t.tryArchive}
            <ArrowRight aria-hidden className="size-4" />
          </a>
          <a
            href="/inbox/"
            className="inline-flex h-11 items-center rounded-lg border border-line bg-raised px-5 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
          >
            {t.tryInbox}
          </a>
        </div>
        <p className="mt-5 text-meta text-muted">{t.noSignup}</p>
        <figure className="mt-16 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_40px_120px_-40px_color-mix(in_oklab,var(--color-accent-solid)_45%,transparent)]">
          <img
            src={`/screens/archive-${lang}.png`}
            alt={t.shotAlt[0]}
            width={1440}
            height={900}
            className="block h-auto w-full"
          />
        </figure>
      </div>
    </section>
  );
}
