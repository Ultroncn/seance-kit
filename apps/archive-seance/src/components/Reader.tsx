import { banishItems, restoreItems, undoBanish } from "@seance/core";
import { Badge, Button, EmptyState, Tooltip, useT, useToast } from "@seance/ui";
import { useEffect, useState, type ReactNode } from "react";
import {
  CONVERSATIONS,
  RESURRECTIONS,
  SOURCE_LABEL,
  type Conversation,
  type Resurrection,
} from "../domain/types";
import { toMarkdown } from "../importers";
import { archiveMessages } from "../messages";
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
  const t = useT(archiveMessages);
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
  const assistant = c.source === "markdown" ? t.assistant : SOURCE_LABEL[c.source];

  const banish = async () => {
    const r = await banishItems(storage, CONVERSATIONS, [c.id], new Date());
    onChanged();
    toast({
      text: t.banishedToast(c.title),
      action: {
        label: t.undo,
        onClick: () => void undoBanish(storage, r.undoToken).then(onChanged),
      },
    });
  };
  const restore = async () => {
    await restoreItems(storage, CONVERSATIONS, [c.id]);
    onChanged();
    toast({ text: t.restoredOne(c.title), tone: "ok" });
  };
  const resurrect = async () => {
    const r = await registry.run("resurrect_conversation", { id: c.id }, toolContext());
    if (!r.ok) return toast({ text: r.error.message, tone: "error" });
    onChanged();
    toast({ text: t.resurrectReady, tone: "ok" });
  };

  return (
    <article className="mx-auto max-w-3xl px-8 py-8" aria-labelledby="reader-title">
      {c.banishedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blood/50 bg-raised px-4 py-3 text-sm">
          <span className="flex-1">{t.banishedNote}</span>
          <Button size="sm" onClick={() => void restore()}>
            {t.restore}
          </Button>
        </div>
      )}

      <header>
        <h2 id="reader-title" className="text-2xl font-semibold leading-tight">
          {c.title}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {SOURCE_LABEL[c.source]} · {shortDate(c.createdAt)} · {t.messages(c.messages.length)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tooltip content={t.resurrectTip}>
            <Button variant="primary" size="sm" onClick={() => void resurrect()}>
              {t.resurrect}
            </Button>
          </Tooltip>
          <Button
            size="sm"
            onClick={() => copy(toMarkdown(c), () => toast({ text: t.copiedMarkdown }))}
          >
            {t.copyMarkdown}
          </Button>
          {!c.banishedAt && (
            <Tooltip content={t.banishTip}>
              <Button
                size="sm"
                variant="ghost"
                className="text-blood hover:text-blood"
                onClick={() => void banish()}
              >
                {t.banish}
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      {(c.summary || c.tags.length > 0) && (
        <section
          aria-label={t.summaryAndTags}
          className="mt-6 rounded-lg border border-line bg-surface p-4"
        >
          {c.summary && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ecto">
                {t.summary}
                {c.summarizedBy === "demo" && t.byDemo}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{c.summary}</p>
            </>
          )}
          {c.tags.length > 0 && (
            <div className={c.summary ? "mt-3 flex flex-wrap gap-1.5" : "flex flex-wrap gap-1.5"}>
              {c.tags.map((tag) => (
                <Badge key={tag} tone="ecto">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}

      {resurrection && (
        <section
          aria-label={t.resurrectionPrompt}
          className="mt-4 rounded-lg border border-ecto/40 bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ecto">
              {t.resurrectionPrompt}
            </p>
            <span className="text-[11px] text-muted">{shortDate(resurrection.createdAt)}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => copy(resurrection.prompt, () => toast({ text: t.promptCopied }))}
            >
              {t.copy}
            </Button>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">
            {resurrection.prompt}
          </pre>
        </section>
      )}

      <ol className="mt-8 space-y-6" aria-label={t.messagesList}>
        {c.messages.map((m, i) => (
          <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
            <span
              className={
                m.role === "user"
                  ? "pt-0.5 text-xs font-semibold text-muted"
                  : "pt-0.5 text-xs font-semibold text-ecto"
              }
            >
              {m.role === "user" ? t.you : assistant}
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
  const t = useT(archiveMessages);
  return (
    <EmptyState
      title={t.emptyTitle}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSample} disabled={loading}>
            {t.cmdSample}
          </Button>
          <Button onClick={onPick} disabled={loading}>
            {t.importExport}
          </Button>
        </div>
      }
    >
      {t.emptyText}
    </EmptyState>
  );
}
