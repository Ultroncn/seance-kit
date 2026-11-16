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
  const [prompt, setPrompt] = useState("");
  const mail = (id: string) => byId.get(id);
  const line = (id: string) => {
    const e = mail(id);
    return e ? `${e.from.name || e.from.address}: ${e.subject}` : id;
  };

  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    const text = prompt.trim();
    if (!text || agent.busy) return;
    setPrompt("");
    void agent.run(text);
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
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-1 pr-2 text-fg">{mail(str(r.id))?.subject ?? str(r.id)}</td>
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
          toolLabels={INBOX_TOOL_LABELS}
          describeApproval={describeApproval}
          empty={
            <EmptyState title="Exorcise your inbox">
              The agent can search, read, sort, label, draft replies and banish mail. It asks before
              changing anything and can never send email.
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
            your mail.
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="agent-prompt" className="sr-only">
            Ask about your mail
          </label>
          <TextArea
            id="agent-prompt"
            rows={2}
            value={prompt}
            placeholder={hasData ? "Ask about your mail…" : "Load or import mail first"}
            className="min-h-0 flex-1 resize-none"
            onChange={(ev) => setPrompt(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                ev.preventDefault();
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
