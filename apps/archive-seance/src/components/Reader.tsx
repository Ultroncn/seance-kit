import { banishItems, restoreItems, undoBanish } from "@seance/core";
import { Badge, Button, EmptyState, Tooltip, useToast } from "@seance/ui";
import { useEffect, useState, type ReactNode } from "react";
import {
  CONVERSATIONS,
  RESURRECTIONS,
  SOURCE_LABEL,
  type Conversation,
  type Resurrection,
} from "../domain/types";
import { toMarkdown } from "../importers";
import { registry, storage, toolContext } from "../runtime";
import { shortDate } from "./format";

/** Plain text with ``` fenced code blocks rendered as code. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="my-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed"
          >
            {part.replace(/^[\w+-]*\n/, "")}
          </pre>
        ) : (
          part.trim() !== "" && (
            <p key={i} className="whitespace-pre-wrap">
              {part.replace(/^\n+|\n+$/g, "")}
            </p>
          )
        ),
      )}
    </>
  );
}

function copy(text: string, done: () => void) {
  void navigator.clipboard?.writeText(text).then(done, done);
}

interface Props {
  conversation: Conversation | undefined;
  version: number;
  onChanged: () => void;
  empty: ReactNode;
}

export function Reader({ conversation: c, version, onChanged, empty }: Props) {
  const toast = useToast();
  const [resurrection, setResurrection] = useState<Resurrection | null>(null);

  useEffect(() => {
    let live = true;
    setResurrection(null);
    if (!c) return;
    void storage.list<Resurrection>(RESURRECTIONS).then((all) => {
      const mine = all
        .filter((r) => r.conversationId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (live) setResurrection(mine[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, [c, version]);

  if (!c) return <>{empty}</>;
  const assistant = c.source === "markdown" ? "Assistant" : SOURCE_LABEL[c.source];

  const banish = async () => {
    const r = await banishItems(storage, CONVERSATIONS, [c.id], new Date());
    onChanged();
    toast({
      text: `Banished “${c.title}”.`,
      action: {
        label: "Undo",
        onClick: () => void undoBanish(storage, r.undoToken).then(onChanged),
      },
    });
  };
  const restore = async () => {
    await restoreItems(storage, CONVERSATIONS, [c.id]);
    onChanged();
    toast({ text: `Restored “${c.title}”.`, tone: "ok" });
  };
  const resurrect = async () => {
    const r = await registry.run("resurrect_conversation", { id: c.id }, toolContext());
    if (!r.ok) return toast({ text: r.error.message, tone: "error" });
    onChanged();
    toast({ text: "Resurrection prompt ready. Copy it into any chat app.", tone: "ok" });
  };

  return (
    <article className="mx-auto max-w-3xl px-8 py-8" aria-labelledby="reader-title">
      {c.banishedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blood/50 bg-raised px-4 py-3 text-sm">
          <span className="flex-1">
            This chat is banished. It is hidden from the library and search.
          </span>
          <Button size="sm" onClick={() => void restore()}>
            Restore
          </Button>
        </div>
      )}

      <header>
        <h2 id="reader-title" className="text-2xl font-semibold leading-tight">
          {c.title}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {SOURCE_LABEL[c.source]} · {shortDate(c.createdAt)} · {c.messages.length} messages
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tooltip content="Write a prompt that restarts this chat in any app, with its context.">
            <Button variant="primary" size="sm" onClick={() => void resurrect()}>
              Resurrect
            </Button>
          </Tooltip>
          <Button
            size="sm"
            onClick={() => copy(toMarkdown(c), () => toast({ text: "Copied as Markdown." }))}
          >
            Copy as Markdown
          </Button>
          {!c.banishedAt && (
            <Tooltip content="Hide from the library and search. Nothing is deleted, and you can undo it.">
              <Button
                size="sm"
                variant="ghost"
                className="text-blood hover:text-blood"
                onClick={() => void banish()}
              >
                Banish
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      {(c.summary || c.tags.length > 0) && (
        <section
          aria-label="Summary and tags"
          className="mt-6 rounded-lg border border-line bg-surface p-4"
        >
          {c.summary && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ecto">
                Summary{c.summarizedBy === "demo" && " · scripted by demo mode"}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{c.summary}</p>
            </>
          )}
          {c.tags.length > 0 && (
            <div className={c.summary ? "mt-3 flex flex-wrap gap-1.5" : "flex flex-wrap gap-1.5"}>
              {c.tags.map((t) => (
                <Badge key={t} tone="ecto">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}

      {resurrection && (
        <section
          aria-label="Resurrection prompt"
          className="mt-4 rounded-lg border border-ecto/40 bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ecto">
              Resurrection prompt
            </p>
            <span className="text-[11px] text-muted">{shortDate(resurrection.createdAt)}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() =>
                copy(resurrection.prompt, () =>
                  toast({ text: "Prompt copied. Paste it into any chat app." }),
                )
              }
            >
              Copy
            </Button>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">
            {resurrection.prompt}
          </pre>
        </section>
      )}

      <ol className="mt-8 space-y-6" aria-label="Messages">
        {c.messages.map((m, i) => (
          <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
            <span
              className={
                m.role === "user"
                  ? "pt-0.5 text-xs font-semibold text-muted"
                  : "pt-0.5 text-xs font-semibold text-ecto"
              }
            >
              {m.role === "user" ? "You" : assistant}
            </span>
            <div className="space-y-2 text-sm leading-relaxed">
              <MessageText text={m.text} />
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function ArchiveEmpty({
  onSample,
  onPick,
  loading,
}: {
  onSample: () => void;
  onPick: () => void;
  loading: boolean;
}) {
  return (
    <EmptyState
      title="Your archive is empty"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSample} disabled={loading}>
            Load the sample archive
          </Button>
          <Button onClick={onPick} disabled={loading}>
            Import an export…
          </Button>
        </div>
      }
    >
      Drop a ChatGPT or Claude export here: the .zip, or the conversations.json inside it. Markdown
      and text chats work too. Everything stays in this browser.
    </EmptyState>
  );
}
