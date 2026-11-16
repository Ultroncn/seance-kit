import type { ReactNode } from "react";
import { TimelineDemo } from "./TimelineDemo";

const REPO = "https://github.com/Ultroncn/seance-kit";
/** Set once the demo video is uploaded (task 5.3). The section stays hidden until then. */
const VIDEO_URL = "";

const apps = [
  {
    name: "Archive Séance",
    href: "/archive/",
    blurb: "Your old AI chats, searchable and alive again.",
    points: [
      "Import ChatGPT and Claude exports, zip and all",
      "Summarize, tag and banish with approval",
      "Resurrect a chat into a ready-to-paste prompt",
    ],
  },
  {
    name: "Inbox Exorcist",
    href: "/inbox/",
    blurb: "Triage an email archive with an agent that can never send.",
    points: [
      "Import .mbox from Google Takeout or Thunderbird",
      "Sort, label and draft replies in batches",
      "Banish newsletters in bulk, then undo",
    ],
  },
] as const;

const steps: { title: string; text: string; code: string }[] = [
  {
    title: "Define a tool",
    text: "One zod schema gives validation, the JSON Schema for models, and the MCP definition. The risk level decides whether it waits for approval.",
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
    title: "Run the agent",
    text: "The loop enforces a step budget, validates every call and pauses for approval. The provider comes from Settings, or the scripted demo.",
    code: `const registry = new ToolRegistry().register(addNote());
const { provider } = useProviderMode();
const agent = useAgentRun({ provider, registry, storage });`,
  },
  {
    title: "Render it",
    text: "The shared kit draws the séance timeline, approval cards, palette and settings. You write the view of your data.",
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

const safety = [
  ["Asks first", "Every tool that writes or hides data waits for Allow. Rejections are respected."],
  ["Nothing is lost", "Banish is a soft delete with undo and a Banished view."],
  [
    "Honest demo",
    "The scripted provider always shows a Demo mode badge. Bring your own key for a real model.",
  ],
  [
    "Stays local",
    "Data lives in your browser. Keys are never exported. Inbox Exorcist cannot send mail.",
  ],
] as const;

const kiro = [
  {
    title: "Specs",
    body: "Requirements, design and a task list drove every milestone.",
    href: `${REPO}/tree/main/.kiro/specs/seance-kit`,
  },
  {
    title: "Steering",
    body: "Product, tech, structure, design and testing rules kept each change consistent.",
    href: `${REPO}/tree/main/.kiro/steering`,
  },
  {
    title: "MCP",
    body: "Both apps ship an MCP server with the same tools, so Kiro can search, sort and draft from the chat.",
    href: `${REPO}/tree/main/packages/mcp-server`,
  },
  {
    title: "Write-up",
    body: "What Kiro did, and the bugs our property tests and axe checks caught along the way.",
    href: `${REPO}/blob/main/KIRO_USAGE.md`,
  },
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
        <nav aria-label="Site" className="ml-auto flex gap-5 text-sm text-muted">
          <a className="hover:text-fg" href="/kit/">
            UI kit
          </a>
          <a className="hover:text-fg" href={REPO}>
            GitHub
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="pb-24 pt-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-candle">
            A local-first agent template
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Build your own agent app in an afternoon.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Define typed tools. Séance Kit brings the agent loop, approval gates, browser storage,
            search and a polished dark UI. Two apps are built with it. Your data stays on your
            device.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/archive/"
              className="rounded-md bg-ecto px-5 py-2.5 text-sm font-semibold text-bg hover:brightness-110"
            >
              Try Archive Séance
            </a>
            <a
              href="/inbox/"
              className="rounded-md border border-line bg-raised px-5 py-2.5 text-sm font-semibold hover:border-muted"
            >
              Try Inbox Exorcist
            </a>
            <a
              href={REPO}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-muted hover:text-fg"
            >
              Read the code →
            </a>
          </div>
          <p className="mt-5 text-xs text-muted">
            No sign-up. The demo runs without a key, on sample data, and says so.
          </p>
        </section>

        <Section
          id="demo-heading"
          title="Every change waits for you"
          intro="The séance timeline shows each step the agent takes. Anything that writes or hides data stops for your Allow. Try it."
        >
          <TimelineDemo />
        </Section>

        <Section id="apps-heading" title="Two apps built with it">
          <div className="grid gap-4 sm:grid-cols-2">
            {apps.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="group block rounded-xl border border-line bg-surface p-6 hover:border-ecto/50 hover:bg-raised"
              >
                <span className="text-xl font-medium text-ecto">{a.name}</span>
                <span className="mt-2 block text-fg">{a.blurb}</span>
                <ul className="mt-4 space-y-1.5 text-sm text-muted">
                  {a.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="text-ecto">
                        ·
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 block text-sm text-muted group-hover:text-fg">
                  Open the app →
                </span>
              </a>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Both apps share one UI kit.{" "}
            <a className="text-ecto underline underline-offset-4 hover:decoration-2" href="/kit/">
              See the components live
            </a>
            .
          </p>
        </Section>

        <Section
          id="build-heading"
          title="How an app is built"
          intro={
            <>
              Start with{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-sm text-fg">
                pnpm new:app my-app
              </code>
              . It copies a small working app that you shape in three steps.
            </>
          }
        >
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="grid gap-5 rounded-xl border border-line bg-surface p-5 lg:grid-cols-[17rem_minmax(0,1fr)]"
              >
                <div>
                  <p className="font-mono text-xs text-candle">0{i + 1}</p>
                  <h3 className="mt-1 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.text}</p>
                </div>
                <pre
                  tabIndex={0}
                  aria-label={`Code: ${s.title}`}
                  className="overflow-x-auto rounded-lg border border-line bg-bg p-4 font-mono text-[12.5px] leading-relaxed text-fg"
                >
                  <code>{s.code}</code>
                </pre>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="safety-heading" title="Safe by default">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {safety.map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-surface p-5">
                <dt className="font-medium text-fg">{t}</dt>
                <dd className="mt-1.5 text-sm text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {VIDEO_URL && (
          <Section id="video-heading" title="See it in three minutes">
            <a className="text-ecto underline underline-offset-4" href={VIDEO_URL}>
              Watch the demo video
            </a>
          </Section>
        )}

        <Section
          id="kiro-heading"
          title="Built with Kiro"
          intro={
            <>
              The whole project is open, including the <code className="font-mono">.kiro</code>{" "}
              folder that drove it.
            </>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {kiro.map((k) => (
              <li key={k.title} className="rounded-xl border border-line bg-surface p-5">
                <a
                  className="font-medium text-candle underline-offset-4 hover:underline"
                  href={k.href}
                >
                  {k.title}
                </a>
                <p className="mt-1 text-sm text-muted">{k.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 border-t border-line px-6 py-8 text-sm text-muted">
        <span>MIT licensed.</span>
        <a className="underline underline-offset-4" href={REPO}>
          Source on GitHub
        </a>
        <span>Made for Kiroween 2026.</span>
      </footer>
    </div>
  );
}
