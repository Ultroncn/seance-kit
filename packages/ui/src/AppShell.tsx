import type { ReactNode } from "react";
import { cn } from "./cn";
import { Inbox, type LucideIcon } from "lucide-react";
import { BrandMark } from "./BrandMark";
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
      <a
        href="#seance-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
      >
        {t.skipToContent}
      </a>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg px-3">
        <a
          href="/"
          aria-label={t.home}
          className="grid size-8 place-items-center rounded-md transition-colors duration-100 hover:bg-raised"
        >
          <BrandMark />
        </a>
        {mark}
        <h1 className="text-sm font-semibold text-fg">{title}</h1>
        <div className="ml-auto flex items-center gap-1.5">
          {actions}
          <LanguageSwitch className="ml-1" />
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
          className={cn(pane, "border-r border-line bg-surface")}
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
    <div className="sticky top-0 z-10 flex h-10 shrink-0 items-center gap-2 border-b border-line bg-inherit px-4">
      <h2 className="text-meta font-medium text-fg-2">{title}</h2>
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </div>
  );
}

/** Calm empty state. Says plainly what to do next. */
export function EmptyState({
  title,
  children,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** A lucide icon that hints at what will appear here. */
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span
        aria-hidden
        className="mb-4 grid size-10 place-items-center rounded-lg border border-line bg-raised text-muted"
      >
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
