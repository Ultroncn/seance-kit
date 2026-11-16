import { banishItems, restoreItems, undoBanish } from "@seance/core";
import { Badge, Button, EmptyState, Tooltip, useT, useToast } from "@seance/ui";
import { Copy, EyeOff, Sparkles, User } from "lucide-react";
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
import { SourceIcon } from "./SourceIcon";

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
    <article className="mx-auto max-w-[720px] px-10 py-8" aria-labelledby="reader-title">
      {c.banishedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-danger-soft px-4 py-3 text-sm text-fg">
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
        <p className="mt-2 flex items-center gap-1.5 text-meta text-muted">
          <SourceIcon source={c.source} />
          {SOURCE_LABEL[c.source]} · {shortDate(c.createdAt)} · {t.messages(c.messages.length)}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Tooltip content={t.resurrectTip}>
            <Button variant="primary" onClick={() => void resurrect()}>
              <Sparkles aria-hidden />
              {t.resurrect}
            </Button>
          </Tooltip>
          <Button onClick={() => copy(toMarkdown(c), () => toast({ text: t.copiedMarkdown }))}>
            <Copy aria-hidden />
            {t.copyMarkdown}
          </Button>
          {!c.banishedAt && (
            <Tooltip content={t.banishTip}>
              <Button variant="danger-ghost" className="ml-auto" onClick={() => void banish()}>
                <EyeOff aria-hidden />
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
              <p className="text-xs font-semibold text-accent">
                {t.summary}
                {c.summarizedBy === "demo" && t.byDemo}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{c.summary}</p>
            </>
          )}
          {c.tags.length > 0 && (
            <div className={c.summary ? "mt-3 flex flex-wrap gap-1.5" : "flex flex-wrap gap-1.5"}>
              {c.tags.map((tag) => (
                <Badge key={tag} tone="accent">
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
          className="mt-4 rounded-lg border border-accent/40 bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-accent">{t.resurrectionPrompt}</p>
            <span className="text-xs text-muted">{shortDate(resurrection.createdAt)}</span>
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

      <ol className="mt-8 space-y-6 border-t border-line pt-8" aria-label={t.messagesList}>
        {c.messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "rounded-lg bg-surface px-4 py-3" : "px-4"}>
            <p className="mb-1.5 flex items-center gap-2 text-meta font-semibold text-fg-2">
              {m.role === "user" ? (
                <span className="grid size-4 place-items-center rounded-full bg-surface-3 text-fg-2">
                  <User aria-hidden className="size-3" />
                </span>
              ) : (
                <SourceIcon source={c.source} />
              )}
              {m.role === "user" ? t.you : assistant}
            </p>
            <div className="space-y-3 text-md text-fg">
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
