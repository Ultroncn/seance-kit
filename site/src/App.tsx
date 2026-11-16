import { LanguageSwitch, useT } from "@seance/ui";
import type { ReactNode } from "react";
import { siteMessages } from "./messages";
import { TimelineDemo } from "./TimelineDemo";

const REPO = "https://github.com/Ultroncn/seance-kit";
/** Set once the demo video is uploaded (task 5.3). The section stays hidden until then. */
const VIDEO_URL = "";

const apps = [
  { name: "Archive Séance", href: "/archive/" },
  { name: "Inbox Exorcist", href: "/inbox/" },
] as const;

const steps: { code: string }[] = [
  {
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
    code: `const registry = new ToolRegistry().register(addNote());
const { provider } = useProviderMode();
const agent = useAgentRun({ provider, registry, storage });`,
  },
  {
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
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="pb-24">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-2xl text-muted">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function App() {
  const t = useT(siteMessages);
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-6">
        <span className="flex items-center gap-2 font-mono text-sm tracking-wide text-ecto">
          <span
            aria-hidden
            className="size-2 rounded-full bg-ecto shadow-[0_0_12px_var(--color-ecto)]"
          />
          séance kit
        </span>
        <nav aria-label={t.nav} className="ml-auto flex items-center gap-5 text-sm text-muted">
          <a className="hover:text-fg" href="/kit/">
            {t.uiKit}
          </a>
          <a className="hover:text-fg" href={REPO}>
            GitHub
          </a>
          <span aria-hidden className="h-5 w-px bg-line" />
          <LanguageSwitch />
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="pb-24 pt-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-candle">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            {t.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{t.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/archive/"
              className="rounded-md bg-ecto px-5 py-2.5 text-sm font-semibold text-bg hover:brightness-110"
            >
              {t.tryArchive}
            </a>
            <a
              href="/inbox/"
              className="rounded-md border border-line bg-raised px-5 py-2.5 text-sm font-semibold hover:border-muted"
            >
              {t.tryInbox}
            </a>
            <a
              href={REPO}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-muted hover:text-fg"
            >
              {t.readCode}
            </a>
          </div>
          <p className="mt-5 text-xs text-muted">{t.noSignup}</p>
        </section>

        <Section id="demo-heading" title={t.demoTitle} intro={t.demoIntro}>
          <TimelineDemo />
        </Section>

        <Section id="apps-heading" title={t.appsTitle}>
          <div className="grid gap-4 sm:grid-cols-2">
            {apps.map((a, i) => (
              <a
                key={a.href}
                href={a.href}
                className="group block rounded-xl border border-line bg-surface p-6 hover:border-ecto/50 hover:bg-raised"
              >
                <span className="text-xl font-medium text-ecto">{t.appNames[i] ?? a.name}</span>
                <span className="mt-2 block text-fg">{t.apps[i]?.blurb}</span>
                <ul className="mt-4 space-y-1.5 text-sm text-muted">
                  {t.apps[i]?.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="text-ecto">
                        ·
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 block text-sm text-muted group-hover:text-fg">
                  {t.openApp}
                </span>
              </a>
            ))}
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
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li
                key={i}
                className="grid gap-5 rounded-xl border border-line bg-surface p-5 lg:grid-cols-[17rem_minmax(0,1fr)]"
              >
                <div>
                  <p className="font-mono text-xs text-candle">0{i + 1}</p>
                  <h3 className="mt-1 font-semibold">{t.steps[i]?.title}</h3>
                  <p className="mt-2 text-sm text-muted">{t.steps[i]?.text}</p>
                </div>
                <pre
                  tabIndex={0}
                  aria-label={t.codeOf(t.steps[i]?.title ?? "")}
                  className="overflow-x-auto rounded-lg border border-line bg-bg p-4 font-mono text-[12.5px] leading-relaxed text-fg"
                >
                  <code>{s.code}</code>
                </pre>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="safety-heading" title={t.safetyTitle}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.safety.map(([title, d]) => (
              <div key={title} className="rounded-xl border border-line bg-surface p-5">
                <dt className="font-medium text-fg">{title}</dt>
                <dd className="mt-1.5 text-sm text-muted">{d}</dd>
              </div>
            ))}
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
              <li key={k.id} className="rounded-xl border border-line bg-surface p-5">
                <a
                  className="font-medium text-candle underline-offset-4 hover:underline"
                  href={k.href}
                >
                  {t.kiro[k.id][0]}
                </a>
                <p className="mt-1 text-sm text-muted">{t.kiro[k.id][1]}</p>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 border-t border-line px-6 py-8 text-sm text-muted">
        <span>{t.mit}</span>
        <a className="underline underline-offset-4" href={REPO}>
          {t.source}
        </a>
        <span>{t.madeFor}</span>
      </footer>
    </div>
  );
}
