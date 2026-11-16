import type { AgentRunState } from "@seance/react";
import { AgentPanel, useT, type ToolEntry } from "@seance/ui";
import { archiveDemoMessages, archiveMessages } from "../messages";
import type { Conversation } from "../domain/types";
import { monthYear } from "./format";

interface Props {
  agent: AgentRunState;
  isMock: boolean;
  byId: Map<string, Conversation>;
  hasData: boolean;
  onManageProviders?: () => void;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function AgentPane({ agent, isMock, byId, hasData, onManageProviders }: Props) {
  const t = useT(archiveMessages);
  const prompts = useT(archiveDemoMessages).prompts;
  const titleOf = (id: string) => byId.get(id)?.title ?? id;
  /** Title plus date and source, so chats with the same title can be told apart. */
  const describe = (id: string) => {
    const c = byId.get(id);
    return c ? t.describeChat(c.title, monthYear(c.createdAt), c.messages.length) : id;
  };

  const describeApproval = (step: ToolEntry) => {
    const input = (step.input ?? {}) as Record<string, unknown>;
    switch (step.name) {
      case "banish_conversation": {
        const ids = strs(input.ids);
        return {
          summary: t.approveBanish(ids.length),
          details: (
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {ids.map((id) => (
                <li key={id}>{describe(id)}</li>
              ))}
            </ul>
          ),
        };
      }
      case "summarize_conversation":
        return {
          summary: t.approveSummary(titleOf(str(input.id))),
          details: (
            <blockquote className="border-l-2 border-warn/60 pl-3 text-fg">
              {str(input.summary)}
            </blockquote>
          ),
        };
      case "tag_conversation": {
        const add = strs(input.add);
        const remove = strs(input.remove);
        return {
          summary: t.approveTags(titleOf(str(input.id))),
          details: (
            <p className="text-fg">
              {add.length > 0 && (
                <>
                  {t.tagsAdd} {add.join(", ")}{" "}
                </>
              )}
              {remove.length > 0 && (
                <>
                  {t.tagsRemove} {remove.join(", ")}
                </>
              )}
            </p>
          ),
        };
      }
      case "resurrect_conversation":
        return {
          summary: t.approveResurrect(titleOf(str(input.id))),
          ...(str(input.note)
            ? {
                details: (
                  <p className="text-fg">
                    {t.noteAdded} “{str(input.note)}”
                  </p>
                ),
              }
            : {}),
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
      onUndo={(token) => void agent.undo(token)}
      onStop={agent.stop}
      onReset={agent.reset}
      suggestions={Object.values(prompts)}
      isMock={isMock}
      hasData={hasData}
      onManageProviders={onManageProviders}
      toolLabels={t.toolLabels}
      describeApproval={describeApproval}
      emptyTitle={t.agentEmptyTitle}
      emptyText={t.agentEmptyText}
      promptLabel={t.promptLabel}
      placeholder={t.placeholder}
      placeholderNoData={t.placeholderNoData}
    />
  );
}
