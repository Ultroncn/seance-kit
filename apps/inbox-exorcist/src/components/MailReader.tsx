import { banishItems, restoreItems, undoBanish } from "@seance/core";
import { Badge, Button, EmptyState, TextArea, Tooltip, useToast } from "@seance/ui";
import { useState, type ReactNode } from "react";
import { getEmail, saveEmail } from "../domain/store";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DRAFTS,
  EMAILS,
  type Category,
  type Draft,
  type Email,
} from "../domain/types";
import { search, storage } from "../runtime";
import { replySubject } from "../tools";
import { formatAddress, replyAddress } from "../tools/shared";
import { CategoryBadge } from "./CategoryBadge";
import { fullDate } from "./format";

/** Opens the user's own mail app with the draft filled in. The user decides whether to send. */
export const mailtoFor = (d: Draft) =>
  `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;

function copy(text: string, done: () => void) {
  void navigator.clipboard?.writeText(text).then(done, done);
}

/** Plain text with bare links made clickable. Links open in a new tab without referrer. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-ecto underline underline-offset-2"
          >
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </div>
  );
}

interface Props {
  email: Email | undefined;
  drafts: Draft[];
  onChanged: () => void;
  empty: ReactNode;
}

export function MailReader({ email: e, drafts, onChanged, empty }: Props) {
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  if (!e) return <>{empty}</>;
  const mine = drafts.filter((d) => d.emailId === e.id);

  const setCategory = async (value: string) => {
    const next = value === "" ? undefined : (value as Category);
    // Read the stored copy first: the agent or a Banish may have changed it since this render.
    const fresh = (await getEmail(storage, e.id)) ?? e;
    const { category: _old, ...rest } = fresh;
    await saveEmail(
      storage,
      search,
      next ? { ...rest, category: next, categorizedAt: new Date().toISOString() } : (rest as Email),
    );
    onChanged();
  };
  const banish = async () => {
    const r = await banishItems(storage, EMAILS, [e.id], new Date());
    onChanged();
    toast({
      text: `Banished “${e.subject}”.`,
      action: {
        label: "Undo",
        onClick: () => void undoBanish(storage, r.undoToken).then(onChanged),
      },
    });
  };
  const restore = async () => {
    await restoreItems(storage, EMAILS, [e.id]);
    onChanged();
    toast({ text: `Restored “${e.subject}”.`, tone: "ok" });
  };
  const saveDraft = async () => {
    const text = body.trim();
    if (!text) return;
    const now = new Date();
    await storage.put<Draft>(DRAFTS, {
      id: `draft:${e.id}:${now.getTime()}`,
      emailId: e.id,
      to: replyAddress(e),
      subject: replySubject(e.subject),
      body: text,
      createdAt: now.toISOString(),
    });
    setBody("");
    setWriting(false);
    onChanged();
    toast({ text: "Draft saved. Nothing was sent.", tone: "ok" });
  };
  const discard = async (d: Draft) => {
    await storage.remove(DRAFTS, d.id);
    onChanged();
  };

  return (
    <article className="mx-auto max-w-3xl px-8 py-8" aria-labelledby="mail-subject">
      {e.banishedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blood/50 bg-raised px-4 py-3 text-sm">
          <span className="flex-1">
            This email is banished. It is hidden from the inbox and search.
          </span>
          <Button size="sm" onClick={() => void restore()}>
            Restore
          </Button>
        </div>
      )}

      <header>
        <h2 id="mail-subject" className="text-2xl font-semibold leading-tight">
          {e.subject}
        </h2>
        <dl className="mt-3 grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">From</dt>
          <dd className="truncate">{formatAddress(e.from) || "Unknown sender"}</dd>
          {e.to.length > 0 && (
            <>
              <dt className="text-muted">To</dt>
              <dd className="truncate">{e.to.map(formatAddress).join(", ")}</dd>
            </>
          )}
          {e.cc.length > 0 && (
            <>
              <dt className="text-muted">Cc</dt>
              <dd className="truncate">{e.cc.map(formatAddress).join(", ")}</dd>
            </>
          )}
          <dt className="text-muted">Date</dt>
          <dd>{fullDate(e.date)}</dd>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setWriting((w) => !w)}>
            Write a reply draft
          </Button>
          {!e.banishedAt && (
            <Tooltip content="Hide from the inbox and search. Nothing is deleted, and your mail server is not touched.">
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
          <label htmlFor="mail-category" className="ml-auto text-xs text-muted">
            Category
          </label>
          <select
            id="mail-category"
            value={e.category ?? ""}
            onChange={(ev) => void setCategory(ev.target.value)}
            className="h-8 rounded-md border border-edge bg-surface px-2 text-xs text-fg"
          >
            <option value="">Not sorted</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        {(e.category || e.labels.length > 0 || e.attachments > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.category && <CategoryBadge category={e.category} />}
            {e.labels.map((l) => (
              <Badge key={l}>{l}</Badge>
            ))}
            {e.attachments > 0 && <Badge>{e.attachments} attachments (not imported)</Badge>}
          </div>
        )}
      </header>

      {writing && (
        <section
          aria-label="Write a reply"
          className="mt-6 rounded-lg border border-line bg-surface p-4"
        >
          <label htmlFor="reply-body" className="text-xs font-medium">
            Reply to {replyAddress(e)}
          </label>
          <TextArea
            id="reply-body"
            rows={5}
            className="mt-2"
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={body.trim() === ""}
              onClick={() => void saveDraft()}
            >
              Save draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWriting(false)}>
              Cancel
            </Button>
            <span className="ml-auto text-[11px] text-muted">
              Drafts are never sent from this app.
            </span>
          </div>
        </section>
      )}

      {mine.map((d) => (
        <section
          key={d.id}
          aria-label={`Draft: ${d.subject}`}
          className="mt-6 rounded-lg border border-ecto/40 bg-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ecto">
              Draft · not sent
            </p>
            <span className="text-[11px] text-muted">To {d.to}</span>
            <span className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(d.body, () => toast({ text: "Draft copied." }))}
              >
                Copy
              </Button>
              <a
                href={mailtoFor(d)}
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted hover:bg-raised hover:text-fg"
              >
                Open in mail app
              </a>
              <Button size="sm" variant="ghost" onClick={() => void discard(d)}>
                Discard
              </Button>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">{d.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{d.body}</pre>
        </section>
      ))}

      <div className="mt-8 border-t border-line pt-6">
        <Body text={e.text || "(This email has no text body.)"} />
      </div>
    </article>
  );
}

export function InboxEmpty({
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
      title="Your inbox is empty"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSample} disabled={loading}>
            Load the sample inbox
          </Button>
          <Button onClick={onPick} disabled={loading}>
            Import mail…
          </Button>
        </div>
      }
    >
      Drop an .mbox file (Google Takeout, Thunderbird, Apple Mail) or .eml files here. Everything
      stays in this browser, and nothing is ever sent.
    </EmptyState>
  );
}
