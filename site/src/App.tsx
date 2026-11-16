import { BrandMark, cn, useLocale, useT } from "@seance/ui";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  HardDrive,
  ShieldCheck,
  Theater,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { CodeTabs } from "./CodeTabs";
import { Hero, Nav, REPO } from "./Hero";
import { siteMessages } from "./messages";
import { TimelineDemo } from "./TimelineDemo";
import { useInView } from "./useInView";

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

/** One card style for the whole page: a surface, a hairline, and a brighter edge on hover. */
const card =
  "block rounded-xl border border-line bg-surface transition-colors duration-150 hover:border-edge";

function Section({
  id,
  title,
  intro,
  split = false,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  /** Heading beside the content instead of above it, for a single wide example. */
  split?: boolean;
  children: ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      aria-labelledby={id}
      className={cn(
        "py-24 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        seen
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
      )}
    >
      <div
        className={cn(
          split && "grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
        )}
      >
        <div className={cn(split && "lg:sticky lg:top-24")}>
          <h2 id={id} className="text-3xl font-semibold text-fg">
            {title}
          </h2>
          {intro && <p className="mt-3 max-w-[560px] text-lg leading-relaxed text-fg-2">{intro}</p>}
        </div>
        <div className={cn(!split && "mt-10")}>{children}</div>
      </div>
    </section>
  );
}

const SAFETY_ICONS = [ShieldCheck, Undo2, Theater, HardDrive];

export function App() {
  const t = useT(siteMessages);
  const lang = useLocale();
  return (
    <div className="min-h-screen bg-bg text-fg">
      <Nav t={t} />
      <Hero t={t} />
      <main className="mx-auto max-w-[1120px] px-6">
        <Section id="demo-heading" title={t.demoTitle} intro={t.demoIntro} split>
          <TimelineDemo />
        </Section>

        <Section id="apps-heading" title={t.appsTitle}>
          <div className="grid gap-5 md:grid-cols-2">
            {apps.map((a, i) => (
              <a key={a.href} href={a.href} className={cn(card, "group overflow-hidden")}>
                <img
                  src={`/screens/${i === 0 ? "archive" : "inbox"}-${lang}.png`}
                  alt={t.shotAlt[i] ?? ""}
                  width={1440}
                  height={900}
                  loading="lazy"
                  className="block aspect-[16/9] w-full border-b border-line object-cover object-left-top"
                />
                <div className="p-6">
                  <span className="block text-lg font-semibold text-fg">
                    {t.appNames[i] ?? a.name}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-fg-2">
                    {t.apps[i]?.blurb}
                  </span>
                  <ul className="mt-4 space-y-2 text-sm text-muted">
                    {t.apps[i]?.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    {t.openApp.replace(/\s*→$/, "")}
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            {t.sharedKit}{" "}
            <a
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              href="/kit/"
            >
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
              <code className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-sm text-fg">
                pnpm new:app my-app
              </code>
              {t.buildRest}
            </>
          }
        >
          <CodeTabs
            label={t.stepsLabel}
            codeOf={t.codeOf}
            steps={steps.map((s, i) => ({
              ...s,
              title: t.steps[i]?.title ?? "",
              text: t.steps[i]?.text ?? "",
            }))}
          />
        </Section>

        <Section id="safety-heading" title={t.safetyTitle}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.safety.map(([title, d], i) => {
              const Icon = SAFETY_ICONS[i] ?? ShieldCheck;
              return (
                <div key={title} className={cn(card, "p-5")}>
                  <Icon aria-hidden className="size-5 text-fg-2" strokeWidth={1.5} />
                  <dt className="mt-4 text-sm font-semibold text-fg">{title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{d}</dd>
                </div>
              );
            })}
          </dl>
        </Section>

        {VIDEO_URL && (
          <Section id="video-heading" title={t.videoTitle}>
            <a
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              href={VIDEO_URL}
            >
              {t.watchVideo}
            </a>
          </Section>
        )}

        <Section
          id="kiro-heading"
          title={t.kiroTitle}
          intro={
            <>
              {t.kiroIntroA} <code className="font-mono text-fg">.kiro</code> {t.kiroIntroB}
            </>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {kiro.map((k) => (
              <li key={k.id}>
                <a href={k.href} className={cn(card, "group h-full p-5")}>
                  <span className="flex items-center justify-between text-sm font-semibold text-fg">
                    {t.kiro[k.id][0]}
                    <ArrowUpRight
                      aria-hidden
                      className="size-4 text-muted transition-colors group-hover:text-accent"
                    />
                  </span>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.kiro[k.id][1]}</p>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-10 text-sm text-muted">
          <span className="flex items-center gap-2 font-medium text-fg-2">
            <BrandMark className="size-4" />
            Séance Kit
          </span>
          <span>{t.mit}</span>
          <a className="transition-colors hover:text-fg" href={REPO}>
            {t.source}
          </a>
          <span className="sm:ml-auto">{t.madeFor}</span>
        </div>
      </footer>
    </div>
  );
}
