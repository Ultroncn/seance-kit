import { useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, PaneHeader } from "./AppShell";
import { Button, TextArea } from "./primitives";
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
}

/**
 * The agent pane every Séance Kit app uses: séance timeline, suggestion chips and a prompt box.
 * Pass `useAgentRun()` state from `@seance/react`. Enter sends, Shift+Enter adds a line.
 */
export function AgentPanel(p: AgentPanelProps) {
  const [prompt, setPrompt] = useState("");

  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    const text = prompt.trim();
    if (!text || p.busy) return;
    setPrompt("");
    p.onRun(text);
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title="Séance"
        actions={
          p.entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={p.onReset} disabled={p.busy}>
              New séance
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SeanceTimeline
          entries={p.entries}
          onApprove={p.onApprove}
          onReject={p.onReject}
          onUndo={p.onUndo}
          undone={p.undone}
          toolLabels={p.toolLabels}
          describeApproval={p.describeApproval}
          empty={<EmptyState title={p.emptyTitle}>{p.emptyText}</EmptyState>}
        />
      </div>

      <div className="border-t border-line p-3">
        {p.suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Suggested prompts">
            {p.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={p.busy || !p.hasData}
                onClick={() => p.onRun(s)}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-ecto hover:text-fg disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {p.isMock && (
          <p className="mb-2 text-[11px] text-muted">
            Demo mode scripts these prompts. The tools, approvals and changes are real and run on
            your data.
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="agent-prompt" className="sr-only">
            {p.promptLabel}
          </label>
          <TextArea
            id="agent-prompt"
            rows={2}
            value={prompt}
            placeholder={p.hasData ? p.placeholder : (p.placeholderNoData ?? p.placeholder)}
            className="min-h-0 flex-1 resize-none"
            onChange={(ev) => setPrompt(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                ev.preventDefault();
                submit();
              }
            }}
          />
          {p.busy ? (
            <Button onClick={p.onStop}>Stop</Button>
          ) : (
            <Button type="submit" variant="primary" disabled={prompt.trim() === ""}>
              Send
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
