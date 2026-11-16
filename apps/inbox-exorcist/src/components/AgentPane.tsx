import type { AgentRunState } from "@seance/react";
import { AgentPanel, type ToolEntry } from "@seance/ui";
import { DEMO_PROMPTS } from "../demo/scripts";
import { CATEGORY_LABEL, type Category, type Email } from "../domain/types";
import { INBOX_TOOL_LABELS } from "../tools";
import { plural } from "./format";

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
          summary: `Hide ${plural(ids.length, "email")}. Nothing is deleted, nothing changes on your mail server, and you can undo it.`,
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
          summary: `Sort ${plural(rows.length, "email")} into categories.`,
          details: (
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Proposed categories</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="pb-1 font-medium">
                    Email
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    Now
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-1 pr-2 text-fg">{mail(str(r.id))?.subject ?? str(r.id)}</td>
                    <td className="py-1 pr-2 text-muted">
                      {(() => {
                        const now = mail(str(r.id))?.category;
                        return now ? CATEGORY_LABEL[now] : "Not sorted";
                      })()}
                    </td>
                    <td className="py-1 text-fg">
                      {CATEGORY_LABEL[str(r.category) as Category] ?? str(r.category)}
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
          summary: `Save a reply draft to ${mail(str(input.id))?.from.address ?? "the sender"}. It will not be sent.`,
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
          summary: `Change labels on “${mail(str(input.id))?.subject ?? str(input.id)}”.`,
          details: (
            <p className="text-fg">
              {add.length > 0 && <>Add: {add.join(", ")}. </>}
              {remove.length > 0 && <>Remove: {remove.join(", ")}.</>}
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
      onUndo={(t) => void agent.undo(t)}
      onStop={agent.stop}
      onReset={agent.reset}
      suggestions={Object.values(DEMO_PROMPTS)}
      isMock={isMock}
      hasData={hasData}
      toolLabels={INBOX_TOOL_LABELS}
      describeApproval={describeApproval}
      emptyTitle="Exorcise your inbox"
      emptyText="The agent can search, read, sort, label, draft replies and banish mail. It asks before changing anything and can never send email."
      promptLabel="Ask about your mail"
      placeholder="Ask about your mail…"
      placeholderNoData="Load or import mail first"
    />
  );
}
