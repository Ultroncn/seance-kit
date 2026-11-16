import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, PaneHeader } from "./AppShell";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { ModelPicker } from "./ModelPicker";
import { ArrowUp, MessageSquare, Sparkles, Square, SquarePen } from "lucide-react";
import { IconButton } from "./primitives";
import { SeanceTimeline, type ApprovalCopy } from "./SeanceTimeline";
import type { TimelineEntry, ToolEntry } from "./timeline-types";

export interface AgentPanelProps {
  entries: TimelineEntry[];
  busy: boolean;
  undone?: ReadonlySet<string>;
  onRun: (prompt: string) => void;
  onApprove: (callId: string) => void;
  onReject: (callId: string) => void;
  onUndo?: (undoToken: string) => void;
  onStop: () => void;
  onReset: () => void;
  /** Starter prompts shown as chips. In demo mode these are the scripted prompts. */
  suggestions: readonly string[];
  /** Shows a note that the prompts are scripted while tools and data are real. */
  isMock: boolean;
  /** False until there is data to work on. Chips are disabled until then. */
  hasData: boolean;
  toolLabels?: Record<string, string>;
  describeApproval?: (step: ToolEntry) => ApprovalCopy | undefined;
  emptyTitle: string;
  emptyText: ReactNode;
  /** Accessible label and placeholder for the prompt box. */
  promptLabel: string;
  placeholder: string;
  placeholderNoData?: string;
  /** Opens settings from the model menu's "Manage providers" item. */
  onManageProviders?: () => void;
}

/**
 * The agent pane every Séance Kit app uses: séance timeline, suggestion chips and a prompt box.
 * Pass `useAgentRun()` state from `@seance/react`. Enter sends, Shift+Enter adds a line.
 */
export function AgentPanel(p: AgentPanelProps) {
  const t = useT(kitMessages);
  const [prompt, setPrompt] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  // Follow the reply as it streams, unless the reader has scrolled up to read something.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [p.entries]);

  const box = useRef<HTMLTextAreaElement>(null);
  /** Grow the prompt box with its text, up to its max height. */
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    const text = prompt.trim();
    if (!text || p.busy) return;
    setPrompt("");
    if (box.current) box.current.style.height = "";
    p.onRun(text);
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title={t.seance}
        actions={
          <IconButton
            aria-label={t.newSeance}
            size="sm"
            onClick={p.onReset}
            disabled={p.busy || p.entries.length === 0}
          >
            <SquarePen />
          </IconButton>
        }
      />
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        // A scroll area must be reachable by keyboard even when nothing inside it can take focus.
        tabIndex={0}
        role="region"
        aria-label={t.agentRun}
        className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-offset-[-2px]"
      >
        <SeanceTimeline
          entries={p.entries}
          onApprove={p.onApprove}
          onReject={p.onReject}
          onUndo={p.onUndo}
          undone={p.undone}
          toolLabels={p.toolLabels}
          describeApproval={p.describeApproval}
          empty={
            <div className="flex min-h-full flex-col justify-center px-4 py-8">
              <EmptyState icon={Sparkles} title={p.emptyTitle}>
                {p.emptyText}
              </EmptyState>
              {p.isMock && (
                <p className="mx-auto -mt-8 mb-6 max-w-80 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-center text-meta text-warn">
                  {t.demoNote}
                </p>
              )}
              {p.suggestions.length > 0 && (
                <div
                  role="group"
                  aria-label={t.suggested}
                  className="mx-auto w-full max-w-80 space-y-1"
                >
                  {p.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={p.busy || !p.hasData}
                      onClick={() => p.onRun(s)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-meta text-fg-2 transition-colors duration-100 hover:bg-raised hover:text-fg disabled:text-disabled disabled:hover:bg-transparent"
                    >
                      <MessageSquare aria-hidden className="size-4 shrink-0 text-muted" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* One card holds the prompt, the model and the send button, like a chat app's composer. */}
      <form onSubmit={submit} className="p-3 pt-2">
        <div className="rounded-xl border border-edge bg-raised transition-[border-color,box-shadow] duration-100 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_22%,transparent)]">
          <label htmlFor="agent-prompt" className="sr-only">
            {p.promptLabel}
          </label>
          <textarea
            id="agent-prompt"
            ref={box}
            rows={1}
            value={prompt}
            placeholder={p.hasData ? p.placeholder : (p.placeholderNoData ?? p.placeholder)}
            className="block max-h-40 min-h-11 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm text-fg outline-none placeholder:text-muted"
            onChange={(ev) => {
              setPrompt(ev.target.value);
              grow(ev.target);
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                ev.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            <ModelPicker onManage={p.onManageProviders} />
            {p.busy ? (
              <IconButton
                aria-label={t.stop}
                size="sm"
                variant="secondary"
                className="ml-auto"
                onClick={p.onStop}
              >
                <Square className="fill-current" />
              </IconButton>
            ) : (
              <IconButton
                aria-label={t.send}
                size="sm"
                variant="primary"
                type="submit"
                className="ml-auto"
                disabled={prompt.trim() === ""}
              >
                <ArrowUp />
              </IconButton>
            )}
          </div>
        </div>
        <p className="mt-1.5 px-1 text-xs text-muted">{t.composerHint}</p>
      </form>
    </div>
  );
}
