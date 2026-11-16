import { LanguageSwitch, cn, useT } from "@seance/ui";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { siteMessages } from "./messages";
import { GlowCard } from "./GlowCard";
import { highlight } from "./highlight";
import { ArchiveIcon, HouseIcon, InboxIcon, MaskIcon, ShieldIcon, UndoIcon } from "./icons";
import { SeanceCircle } from "./SeanceCircle";
import { TimelineDemo } from "./TimelineDemo";
import { useInView } from "./useInView";

const REPO = "https://github.com/Ultroncn/seance-kit";
/** Set once the demo video is uploaded (task 5.3). The section stays hidden until then. */
const VIDEO_URL = "";

const apps = [
  { name: "Archive Séance", href: "/archive/" },
  { name: "Inbox Exorcist", href: "/inbox/" },
] as const;

const steps: { file: string; code: string }[] = [
  {
    file: "src/tools/add_note.ts",
    code: `export const addNote = () =>
  defineTool({
    name: "add_note",
    description: "Save a new note.",
    risk: "write", // waits for the user's Allow
    input: z.object({ title: z.string().min(1) }),
    output: z.object({ id: z.string() }),
    async run({ title }, { storage, now }) {
      const id = \`note-\${now().getTime()}\`;
      await storage.put("notes", { id, title });
      return { id };
    },
  });`,
  },
  {
    file: "src/App.tsx",
    code: `const registry = new ToolRegistry().register(addNote());
const { provider } = useProviderMode();
const agent = useAgentRun({ provider, registry, storage });`,
  },
  {
    file: "src/App.tsx",
    code: `<AppShell
  title="My Agent App"
  actions={<DemoBadge />}
  library={<NoteList />}
  content={<NoteView />}
  agent={
    <AgentPanel
      entries={agent.entries}
      busy={agent.busy}
      onRun={agent.run}
      onApprove={agent.approve}
      onReject={agent.reject}
      onStop={agent.stop}
      onReset={agent.reset}
      suggestions={["Tidy my notes"]}
      isMock={isMock}
      hasData
      emptyTitle="Ask your notebook"
      emptyText="It asks before changing anything."
      promptLabel="Ask your notebook"
      placeholder="Ask about your notes…"
    />
  }
/>`,
  },
];

const kiro = [
  { id: "specs", href: `${REPO}/tree/main/.kiro/specs/seance-kit` },
  { id: "steering", href: `${REPO}/tree/main/.kiro/steering` },
  { id: "mcp", href: `${REPO}/tree/main/packages/mcp-server` },
  { id: "writeup", href: `${REPO}/blob/main/KIRO_USAGE.md` },
] as const;

function Section({
  id,
  title,
  eyebrow,
  intro,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      aria-labelledby={id}
      className={cn(
        "pb-28 transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none",
        seen
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
      )}
    >
      {eyebrow && (
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-candle">{eyebrow}</p>
      )}
      <h2 id={id} className="text-3xl font-semibold tracking-tight [text-wrap:balance] sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

type SiteText = (typeof siteMessages)["en"];

/** Candlelit hero: the pitch on the left, the séance circle on the right, a light that follows the pointer. */
function Hero({ t }: { t: SiteText }) {
  const light = useRef<HTMLDivElement>(null);
  const follow = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    light.current?.style.setProperty("--mx", `${e.clientX - r.left}px`);
    light.current?.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <section
      onPointerMove={follow}
      className="relative isolate overflow-hidden border-b border-line/60"
    >
      {/* Fog and pointer light. Decorative only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 size-[38rem] rounded-full bg-ecto/10 blur-3xl motion-safe:animate-drift" />
        <div
          className="absolute -right-32 bottom-0 size-[30rem] rounded-full bg-candle/10 blur-3xl motion-safe:animate-drift"
          style={{ animationDelay: "-9s" }}
        />
        <div
          ref={light}
          className="absolute inset-0 [background:radial-gradient(28rem_circle_at_var(--mx,70%)_var(--my,40%),color-mix(in_oklab,var(--color-candle)_9%,transparent),transparent_70%)]"
        />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--color-line)_1px,transparent_1px)] [background-size:28px_28px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-candle/30 bg-candle/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-candle">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-candle motion-safe:animate-flicker"
            />
            {t.eyebrow}
          </p>
          <h1 className="mt-6 max-w-3xl bg-gradient-to-b from-fg via-fg to-fg/75 bg-clip-text text-5xl font-semibold leading-[1.06] tracking-tight text-transparent [text-wrap:balance] [word-break:keep-all] sm:text-6xl">
            {t.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t.lede}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/archive/"
              className="rounded-lg bg-ecto px-5 py-3 text-sm font-semibold text-bg shadow-[0_0_0_0_var(--color-ecto)] transition-[box-shadow,filter] duration-150 hover:shadow-[0_0_28px_-4px_var(--color-ecto)] hover:brightness-110"
            >
              {t.tryArchive}
            </a>
            <a
              href="/inbox/"
              className="rounded-lg border border-line bg-raised/80 px-5 py-3 text-sm font-semibold backdrop-blur transition-colors duration-150 hover:border-candle/60"
            >
              {t.tryInbox}
            </a>
            <a
              href={REPO}
              className="rounded-lg px-5 py-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-fg"
            >
              {t.readCode}
            </a>
          </div>
          <p className="mt-5 text-xs text-muted">{t.noSignup}</p>
        </div>
        <SeanceCircle className="mx-auto w-full max-w-[26rem] drop-shadow-[0_0_40px_color-mix(in_oklab,var(--color-ecto)_15%,transparent)] lg:max-w-[30rem]" />
      </div>
    </section>
  );
}

export function App() {
  const t = useT(siteMessages);
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="flex items-center gap-2 font-mono text-sm tracking-wide text-ecto">
            <span
              aria-hidden
              className="size-2 rounded-full bg-ecto shadow-[0_0_12px_var(--color-ecto)] motion-safe:animate-breathe"
            />
            séance kit
          </span>
          <nav aria-label={t.nav} className="ml-auto flex items-center gap-5 text-sm text-muted">
            <a className="transition-colors hover:text-fg" href="/kit/">
              {t.uiKit}
            </a>
            <a className="transition-colors hover:text-fg" href={REPO}>
              GitHub
            </a>
            <span aria-hidden className="h-5 w-px bg-line" />
            <LanguageSwitch />
          </nav>
        </div>
      </header>

      <Hero t={t} />

      <main className="mx-auto max-w-6xl px-6 pt-24">
        <Section id="demo-heading" title={t.demoTitle} intro={t.demoIntro}>
          <TimelineDemo />
        </Section>

        <Section id="apps-heading" title={t.appsTitle}>
          <div className="grid gap-5 sm:grid-cols-2">
            {apps.map((a, i) => {
              const Icon = i === 0 ? ArchiveIcon : InboxIcon;
              const tone = i === 0 ? "ecto" : "candle";
              return (
                <GlowCard key={a.href} href={a.href} tone={tone} className="p-7">
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-xl border",
                      tone === "ecto"
                        ? "border-ecto/30 bg-ecto/10 text-ecto"
                        : "border-candle/30 bg-candle/10 text-candle",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-5 block text-xl font-semibold text-fg">
                    {t.appNames[i] ?? a.name}
                  </span>
                  <span className="mt-1.5 block text-muted">{t.apps[i]?.blurb}</span>
                  <ul className="mt-5 space-y-2 text-sm text-muted">
                    {t.apps[i]?.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            "mt-[0.55em] size-1 shrink-0 rounded-full",
                            tone === "ecto" ? "bg-ecto" : "bg-candle",
                          )}
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg">
                    {t.openApp.replace(/\s*→$/, "")}
                    <span
                      aria-hidden
                      className="transition-transform duration-150 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </GlowCard>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-muted">
            {t.sharedKit}{" "}
            <a className="text-ecto underline underline-offset-4 hover:decoration-2" href="/kit/">
              {t.seeKit}
            </a>
            {t.period}
          </p>
        </Section>

        <Section
          id="build-heading"
          title={t.buildTitle}
          intro={
            <>
              {t.buildStart}{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-sm text-fg">
                pnpm new:app my-app
              </code>
              {t.buildRest}
            </>
          }
        >
          <ol className="space-y-10">
            {steps.map((s, i) => (
              <li
                key={i}
                className="group/step relative grid gap-6 pl-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8"
              >
                {/* The thread joining the three steps, lit at each one. */}
                <span
                  aria-hidden
                  className="absolute left-[0.95rem] top-9 -bottom-5 w-px bg-gradient-to-b from-line to-transparent group-last/step:hidden"
                />
                <span
                  aria-hidden
                  className="absolute left-0 top-0 grid size-8 place-items-center rounded-full border border-candle/40 bg-candle/10 font-mono text-xs text-candle shadow-[0_0_18px_-4px_var(--color-candle)]"
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold">{t.steps[i]?.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t.steps[i]?.text}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-line bg-bg shadow-[0_20px_60px_-30px_black]">
                  <div
                    aria-hidden
                    className="flex items-center gap-1.5 border-b border-line px-4 py-2.5"
                  >
                    <span className="size-2.5 rounded-full bg-blood/60" />
                    <span className="size-2.5 rounded-full bg-candle/60" />
                    <span className="size-2.5 rounded-full bg-ecto/60" />
                    <span className="ml-3 font-mono text-[11px] text-muted">{s.file}</span>
                  </div>
                  <pre
                    tabIndex={0}
                    aria-label={t.codeOf(t.steps[i]?.title ?? "")}
                    className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-muted"
                  >
                    <code>{highlight(s.code)}</code>
                  </pre>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="safety-heading" title={t.safetyTitle}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.safety.map(([title, d], i) => {
              const Icon = [ShieldIcon, UndoIcon, MaskIcon, HouseIcon][i] ?? ShieldIcon;
              return (
                <GlowCard key={title} tone={i % 2 ? "candle" : "ecto"} className="p-5">
                  <Icon className={cn("size-6", i % 2 ? "text-candle" : "text-ecto")} />
                  <dt className="mt-4 font-medium text-fg">{title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{d}</dd>
                </GlowCard>
              );
            })}
          </dl>
        </Section>

        {VIDEO_URL && (
          <Section id="video-heading" title={t.videoTitle}>
            <a className="text-ecto underline underline-offset-4" href={VIDEO_URL}>
              {t.watchVideo}
            </a>
          </Section>
        )}

        <Section
          id="kiro-heading"
          title={t.kiroTitle}
          intro={
            <>
              {t.kiroIntroA} <code className="font-mono">.kiro</code> {t.kiroIntroB}
            </>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {kiro.map((k) => (
              <li key={k.id}>
                <GlowCard href={k.href} tone="candle" className="h-full p-5">
                  <span className="flex items-center justify-between font-medium text-candle">
                    {t.kiro[k.id][0]}
                    <span
                      aria-hidden
                      className="text-muted transition-transform duration-150 group-hover:translate-x-1 group-hover:text-candle"
                    >
                      ↗
                    </span>
                  </span>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.kiro[k.id][1]}</p>
                </GlowCard>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-10 text-sm text-muted">
          <span className="flex items-center gap-2 font-mono text-ecto">
            <span aria-hidden className="size-1.5 rounded-full bg-ecto" />
            séance kit
          </span>
          <span>{t.mit}</span>
          <a className="underline underline-offset-4 transition-colors hover:text-fg" href={REPO}>
            {t.source}
          </a>
          <span className="sm:ml-auto">{t.madeFor}</span>
        </div>
      </footer>
    </div>
  );
}
