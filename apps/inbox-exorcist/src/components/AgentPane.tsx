import type { AgentRunState } from "@seance/react";
import { AgentPanel, useT, type ToolEntry } from "@seance/ui";
import type { Category, Email } from "../domain/types";
import { inboxDemoMessages, inboxMessages } from "../messages";

interface Props {
  agent: AgentRunState;
  isMock: boolean;
  byId: Map<string, Email>;
  hasData: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function AgentPane({ agent, isMock, byId, hasData }: Props) {
  const t = useT(inboxMessages);
  const prompts = useT(inboxDemoMessages).prompts;
  const mail = (id: string) => byId.get(id);
  const line = (id: string) => {
    const e = mail(id);
    return e ? `${e.from.name || e.from.address}: ${e.subject}` : id;
  };

  const describeApproval = (step: ToolEntry) => {
    const input = (step.input ?? {}) as Record<string, unknown>;
    switch (step.name) {
      case "banish_emails": {
        const ids = strs(input.ids);
        return {
          summary: t.approveBanish(ids.length),
          details: (
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {ids.map((id) => (
                <li key={id}>{line(id)}</li>
              ))}
            </ul>
          ),
        };
      }
      case "classify_emails": {
        const rows = Array.isArray(input.assignments)
          ? (input.assignments as { id?: unknown; category?: unknown }[])
          : [];
        return {
          summary: t.approveClassify(rows.length),
          details: (
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{t.proposed}</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="pb-1 font-medium">
                    {t.colEmail}
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    {t.colNow}
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    {t.colCategory}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-1 pr-2 text-fg">{mail(str(r.id))?.subject ?? str(r.id)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-muted">
                      {(() => {
                        const now = mail(str(r.id))?.category;
                        return now ? t.category[now] : t.notSorted;
                      })()}
                    </td>
                    <td className="whitespace-nowrap py-1 text-fg">
                      {t.category[str(r.category) as Category] ?? str(r.category)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        };
      }
      case "draft_reply":
        return {
          summary: t.approveDraft(mail(str(input.id))?.from.address ?? t.theSender),
          details: (
            <blockquote className="whitespace-pre-wrap border-l-2 border-candle/60 pl-3 text-fg">
              {str(input.body)}
            </blockquote>
          ),
        };
      case "label_email": {
        const add = strs(input.add);
        const remove = strs(input.remove);
        return {
          summary: t.approveLabels(mail(str(input.id))?.subject ?? str(input.id)),
          details: (
            <p className="text-fg">
              {add.length > 0 && (
                <>
                  {t.labelsAdd} {add.join(", ")}{" "}
                </>
              )}
              {remove.length > 0 && (
                <>
                  {t.labelsRemove} {remove.join(", ")}
                </>
              )}
            </p>
          ),
        };
      }
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
