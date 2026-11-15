import type { ReactNode } from "react";
import { cn } from "./cn";

export interface AppShellProps {
  /** App name, rendered as the page's h1. */
  title: string;
  /** Small mark before the title, for example an icon. */
  mark?: ReactNode;
  /** Right side of the header: badges, settings, palette hint. */
  actions?: ReactNode;
  library: ReactNode;
  content: ReactNode;
  agent: ReactNode;
  /** Accessible names for the three panes. */
  labels?: { library?: string; content?: string; agent?: string };
}

const pane = "min-h-0 overflow-y-auto";

/**
 * Three-pane layout: library, content, agent. Desktop shows three columns. Tablet keeps
 * library and content side by side with the agent pane below.
 */
export function AppShell({
  title,
  mark,
  actions,
  library,
  content,
  agent,
  labels = {},
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      <a
        href="#seance-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <a href="/" className="text-sm text-muted hover:text-fg" aria-label="Séance Kit home">
          ←
        </a>
        {mark}
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div
        className={cn(
          "grid min-h-0 flex-1",
          "grid-cols-[16rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,22rem)]",
          "lg:grid-cols-[17rem_minmax(0,1fr)_25rem] lg:grid-rows-1",
        )}
      >
        <nav
          aria-label={labels.library ?? "Library"}
          className={cn(pane, "border-r border-line bg-surface")}
        >
          {library}
        </nav>
        <main id="seance-content" aria-label={labels.content ?? "Content"} className={pane}>
          {content}
        </main>
        <aside
          aria-label={labels.agent ?? "Agent"}
          className={cn(
            pane,
            "col-span-2 border-t border-line bg-surface lg:col-span-1 lg:border-t-0 lg:border-l",
          )}
        >
          {agent}
        </aside>
      </div>
    </div>
  );
}

/** Heading row inside a pane. */
export function PaneHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line bg-inherit px-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </div>
  );
}

/** Calm empty state. Says plainly what to do next. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div
        aria-hidden
        className="mb-4 size-2 rounded-full bg-ecto shadow-[0_0_16px_var(--color-ecto)]"
      />
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
