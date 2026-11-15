export function App() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <main className="mx-auto max-w-3xl px-6 py-20">
        <a href="/" className="text-sm text-muted hover:text-fg">
          ← Séance Kit
        </a>
        <h1 className="mt-6 text-4xl font-semibold">Inbox Exorcist</h1>
        <p className="mt-4 text-lg text-muted">
          Triage an .mbox or .eml archive with an agent that never sends mail. Everything stays in
          your browser.
        </p>
        <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          App shell. Features land in milestone M3.
        </p>
      </main>
    </div>
  );
}
