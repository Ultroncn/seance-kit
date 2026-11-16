import type { AgentRunState } from "@seance/react";
import { AgentPanel, type ToolEntry } from "@seance/ui";
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
  const titleOf = (id: string) => byId.get(id)?.title ?? id;

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
    <AgentPanel
      entries={agent.entries}
      busy={agent.busy}
      undone={agent.undone}
      onRun={(p) => void agent.run(p)}
      onApprove={agent.approve}
      onReject={agent.reject}
      onUndo={(t) => void agent.undo(t)}
      onStop={agent.stop}
      onReset={agent.reset}
      suggestions={Object.values(DEMO_PROMPTS)}
      isMock={isMock}
      hasData={hasData}
      toolLabels={ARCHIVE_TOOL_LABELS}
      describeApproval={describeApproval}
      emptyTitle="Ask your archive"
      emptyText="The agent can search, read, summarize, tag, banish and resurrect chats. It asks before changing anything."
      promptLabel="Ask the archive"
      placeholder="Ask about your chats…"
      placeholderNoData="Load or import chats first"
    />
  );
}
