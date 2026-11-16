import type { ReactNode } from "react";
import { cn } from "./cn";
import { Flame } from "./Flame";
import { useT } from "./i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { kitMessages } from "./messages";

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
  const t = useT(kitMessages);
  return (
    // overflow-clip, not overflow-hidden: a hidden box can still be scrolled by focus(), which
    // pushed the whole shell up when an approval card took focus.
    <div className="relative isolate flex h-screen flex-col overflow-clip bg-bg text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-clip">
        <div className="absolute -left-48 -top-48 size-[36rem] rounded-full bg-ecto/[0.06] blur-3xl" />
        <div className="absolute -bottom-56 -right-40 size-[34rem] rounded-full bg-candle/[0.05] blur-3xl" />
      </div>
      <a
        href="#seance-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
      >
        {t.skipToContent}
      </a>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/70 bg-bg/60 px-4 backdrop-blur-md">
        <a
          href="/"
          className="grid size-8 place-items-center rounded-md text-sm text-muted transition-colors hover:bg-raised hover:text-fg"
          aria-label={t.home}
        >
          ←
        </a>
        {mark}
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <LanguageSwitch />
        </div>
      </header>
      <div
        className={cn(
          "grid min-h-0 flex-1",
          "grid-cols-[16rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,22rem)]",
          "lg:grid-cols-[17rem_minmax(0,1fr)_25rem] lg:grid-rows-1",
        )}
      >
        <nav
          aria-label={labels.library ?? t.library}
          className={cn(pane, "border-r border-line/70 bg-surface/70 backdrop-blur-sm")}
        >
          {library}
        </nav>
        <main id="seance-content" aria-label={labels.content ?? t.content} className={pane}>
          {content}
        </main>
        <aside
          aria-label={labels.agent ?? t.agent}
          className={cn(
            pane,
            "col-span-2 border-t border-line/70 bg-surface/70 backdrop-blur-sm lg:col-span-1 lg:border-t-0 lg:border-l",
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
    <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line/70 bg-surface/85 px-4 backdrop-blur-md">
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
      <Candle className="mb-5" />
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A small lit candle for empty states. The flame flickers unless motion is reduced. */
function Candle({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative flex flex-col items-center", className)}>
      <div className="absolute -top-6 size-16 rounded-full bg-candle/15 blur-xl motion-safe:animate-breathe" />
      <Flame className="mt-0 h-6 w-4" />
      <div className="mt-0.5 h-7 w-3.5 rounded-sm border border-line bg-raised" />
    </div>
  );
}
