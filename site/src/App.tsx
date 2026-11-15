const REPO = "https://github.com/Ultroncn/seance-kit";

const apps = [
  {
    name: "Archive Séance",
    href: "/archive/",
    blurb: "Import, search, summarize and resurrect your old AI chats.",
  },
  {
    name: "Inbox Exorcist",
    href: "/inbox/",
    blurb: "Triage an .mbox or .eml archive with an agent that never sends mail.",
  },
] as const;

const kiro = [
  {
    title: "Specs",
    body: "Requirements, design and tasks drive the build.",
    href: `${REPO}/tree/main/.kiro/specs/seance-kit`,
  },
  {
    title: "Steering",
    body: "Product, tech, structure, design and testing rules keep every change consistent.",
    href: `${REPO}/tree/main/.kiro/steering`,
  },
  {
    title: "Hooks",
    body: "Typecheck and tests run on save.",
    href: `${REPO}/tree/main/.kiro`,
  },
  {
    title: "MCP",
    body: "Our own MCP server lets Kiro call the apps' tools.",
    href: `${REPO}/tree/main/.kiro`,
  },
] as const;

export function App() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm tracking-wide text-ecto">séance kit</span>
        <a className="text-sm text-muted hover:text-fg" href={REPO}>
          GitHub
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20">
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight">
            Build your own agent app in an afternoon.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Séance Kit is a local-first template. Define typed tools and get an agent loop, approval
            gates, browser storage and a polished dark UI. Your data stays on your device.
          </p>
        </section>

        <section aria-labelledby="apps-heading" className="pb-20">
          <h2 id="apps-heading" className="text-2xl font-semibold">
            Two apps built with it
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {apps.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="block rounded-lg border border-line bg-surface p-6 hover:bg-raised"
              >
                <span className="text-xl font-medium text-ecto">{a.name}</span>
                <span className="mt-2 block text-muted">{a.blurb}</span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="kiro-heading" className="pb-20">
          <h2 id="kiro-heading" className="text-2xl font-semibold">
            Built with Kiro
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            The whole project lives in the open, including the{" "}
            <code className="font-mono">.kiro</code> folder.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {kiro.map((k) => (
              <li key={k.title} className="rounded-lg border border-line bg-surface p-5">
                <a className="font-medium text-candle hover:underline" href={k.href}>
                  {k.title}
                </a>
                <p className="mt-1 text-muted">{k.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-line px-6 py-8 text-sm text-muted">
        MIT licensed.{" "}
        <a className="underline" href={REPO}>
          Source on GitHub
        </a>
        . Work in progress for Kiroween 2026.
      </footer>
    </div>
  );
}
