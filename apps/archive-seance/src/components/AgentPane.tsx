import type { AgentRunState } from "@seance/react";
import {
  Button,
  EmptyState,
  PaneHeader,
  SeanceTimeline,
  TextArea,
  type ToolEntry,
} from "@seance/ui";
import { useState, type FormEvent } from "react";
import { DEMO_PROMPTS } from "../demo/scripts";
import { ARCHIVE_TOOL_LABELS } from "../tools";
import type { Conversation } from "../domain/types";
import { plural } from "./format";

interface Props {
  agent: AgentRunState;
  isMock: boolean;
  byId: Map<string, Conversation>;
  hasData: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function AgentPane({ agent, isMock, byId, hasData }: Props) {
  const [prompt, setPrompt] = useState("");
  const titleOf = (id: string) => byId.get(id)?.title ?? id;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || agent.busy) return;
    setPrompt("");
    void agent.run(text);
  };

  const describeApproval = (step: ToolEntry) => {
    const input = (step.input ?? {}) as Record<string, unknown>;
    switch (step.name) {
      case "banish_conversation": {
        const ids = strs(input.ids);
        return {
          summary: `Hide ${plural(ids.length, "chat")}. Nothing is deleted, and you can undo it.`,
          details: (
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {ids.map((id) => (
                <li key={id}>{titleOf(id)}</li>
              ))}
            </ul>
          ),
        };
      }
      case "summarize_conversation":
        return {
          summary: `Save this summary on “${titleOf(str(input.id))}”:`,
          details: (
            <blockquote className="border-l-2 border-candle/60 pl-3 text-fg">
              {str(input.summary)}
            </blockquote>
          ),
        };
      case "tag_conversation": {
        const add = strs(input.add);
        const remove = strs(input.remove);
        return {
          summary: `Change tags on “${titleOf(str(input.id))}”.`,
          details: (
            <p className="text-fg">
              {add.length > 0 && <>Add: {add.join(", ")}. </>}
              {remove.length > 0 && <>Remove: {remove.join(", ")}.</>}
            </p>
          ),
        };
      }
      case "resurrect_conversation":
        return {
          summary: `Write a resurrection prompt for “${titleOf(str(input.id))}” and save it with the chat.`,
        };
      default:
        return undefined;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title="Séance"
        actions={
          agent.entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={agent.reset} disabled={agent.busy}>
              New séance
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SeanceTimeline
          entries={agent.entries}
          onApprove={agent.approve}
          onReject={agent.reject}
          onUndo={(t) => void agent.undo(t)}
          undone={agent.undone}
          toolLabels={ARCHIVE_TOOL_LABELS}
          describeApproval={describeApproval}
          empty={
            <EmptyState title="Ask your archive">
              The agent can search, read, summarize, tag, banish and resurrect chats. It asks before
              changing anything.
            </EmptyState>
          }
        />
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Suggested prompts">
          {Object.values(DEMO_PROMPTS).map((p) => (
            <button
              key={p}
              type="button"
              disabled={agent.busy || !hasData}
              onClick={() => void agent.run(p)}
              className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-ecto hover:text-fg disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        {isMock && (
          <p className="mb-2 text-[11px] text-muted">
            Demo mode scripts these prompts. The tools, approvals and changes are real and run on
            your data.
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="agent-prompt" className="sr-only">
            Ask the archive
          </label>
          <TextArea
            id="agent-prompt"
            rows={2}
            value={prompt}
            placeholder={hasData ? "Ask about your chats…" : "Load or import chats first"}
            className="min-h-0 flex-1 resize-none"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {agent.busy ? (
            <Button onClick={agent.stop}>Stop</Button>
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
