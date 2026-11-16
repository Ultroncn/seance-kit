import { banishItems, restoreItems, undoBanish } from "@seance/core";
import { Badge, Button, EmptyState, Select, TextArea, Tooltip, useT, useToast } from "@seance/ui";
import { EyeOff, Reply } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getEmail, saveEmail } from "../domain/store";
import { CATEGORIES, DRAFTS, EMAILS, type Category, type Draft, type Email } from "../domain/types";
import { inboxMessages } from "../messages";
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
            className="text-accent underline underline-offset-2"
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
  const t = useT(inboxMessages);
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
      text: t.banishedToast(e.subject),
      action: {
        label: t.undo,
        onClick: () => void undoBanish(storage, r.undoToken).then(onChanged),
      },
    });
  };
  const restore = async () => {
    await restoreItems(storage, EMAILS, [e.id]);
    onChanged();
    toast({ text: t.restoredOne(e.subject), tone: "ok" });
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
    toast({ text: t.draftSaved, tone: "ok" });
  };
  const discard = async (d: Draft) => {
    await storage.remove(DRAFTS, d.id);
    onChanged();
  };

  return (
    <article className="mx-auto max-w-[720px] px-10 py-8" aria-labelledby="mail-subject">
      {e.banishedAt && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-danger-soft px-4 py-3 text-sm text-fg">
          <span className="flex-1">{t.banishedNote}</span>
          <Button size="sm" onClick={() => void restore()}>
            {t.restore}
          </Button>
        </div>
      )}

      <header>
        <h2 id="mail-subject" className="text-2xl font-semibold leading-tight">
          {e.subject}
        </h2>
        <dl className="mt-4 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-meta">
          <dt className="text-muted">{t.from}</dt>
          <dd className="truncate">{formatAddress(e.from) || t.unknownSender}</dd>
          {e.to.length > 0 && (
            <>
              <dt className="text-muted">{t.to}</dt>
              <dd className="truncate">{e.to.map(formatAddress).join(", ")}</dd>
            </>
          )}
          {e.cc.length > 0 && (
            <>
              <dt className="text-muted">{t.cc}</dt>
              <dd className="truncate">{e.cc.map(formatAddress).join(", ")}</dd>
            </>
          )}
          <dt className="text-muted">{t.date}</dt>
          <dd>{fullDate(e.date)}</dd>
          {/* The mailbox only matters when it is not already the recipient shown above. */}
          {e.mailbox && !e.to.some((a) => a.address === e.mailbox) && (
            <>
              <dt className="text-muted">{t.mailboxLabel}</dt>
              <dd className="truncate">{e.mailbox}</dd>
            </>
          )}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setWriting((w) => !w)}>
            <Reply aria-hidden />
            {t.writeDraft}
          </Button>
          <label htmlFor="mail-category" className="sr-only">
            {t.categoryLabel}
          </label>
          <Select
            id="mail-category"
            value={e.category ?? ""}
            onChange={(ev) => void setCategory(ev.target.value)}
          >
            <option value="">{t.notSorted}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.category[c]}
              </option>
            ))}
          </Select>
          {!e.banishedAt && (
            <Tooltip content={t.banishTip}>
              <Button variant="danger-ghost" className="ml-auto" onClick={() => void banish()}>
                <EyeOff aria-hidden />
                {t.banish}
              </Button>
            </Tooltip>
          )}
        </div>
        {(e.category || e.labels.length > 0 || e.attachments > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.category && <CategoryBadge category={e.category} />}
            {e.labels.map((l) => (
              <Badge key={l}>{l}</Badge>
            ))}
            {e.attachments > 0 && <Badge>{t.attachments(e.attachments)}</Badge>}
          </div>
        )}
      </header>

      {writing && (
        <section
          aria-label={t.writeReply}
          className="mt-6 rounded-lg border border-line bg-surface p-4"
        >
          <label htmlFor="reply-body" className="text-xs font-medium">
            {t.replyTo(replyAddress(e))}
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
              {t.saveDraft}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWriting(false)}>
              {t.cancel}
            </Button>
            <span className="ml-auto text-xs text-muted">{t.neverSent}</span>
          </div>
        </section>
      )}

      {mine.map((d) => (
        <section
          key={d.id}
          aria-label={t.draftAria(d.subject)}
          className="mt-6 rounded-lg border border-accent/40 bg-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-accent">
              {t.draftNotSent}
              {d.by === "demo" && t.byDemo}
            </p>
            <span className="text-xs text-muted">{t.toAddr(d.to)}</span>
            <span className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(d.body, () => toast({ text: t.draftCopied }))}
              >
                {t.copy}
              </Button>
              <a
                href={mailtoFor(d)}
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted hover:bg-raised hover:text-fg"
              >
                {t.openMailApp}
              </a>
              <Button size="sm" variant="ghost" onClick={() => void discard(d)}>
                {t.discard}
              </Button>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">{d.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{d.body}</pre>
        </section>
      ))}

      <div className="mt-8 border-t border-line pt-6">
        <Body text={e.text || t.noBody} />
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
  const t = useT(inboxMessages);
  return (
    <EmptyState
      title={t.emptyTitle}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSample} disabled={loading}>
            {t.cmdSample}
          </Button>
          <Button onClick={onPick} disabled={loading}>
            {t.cmdImport}
          </Button>
        </div>
      }
    >
      {t.emptyText}
    </EmptyState>
  );
}
