import { restoreItems } from "@seance/core";
import { Badge, Button, Input, PaneHeader, cn, useToast } from "@seance/ui";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_LABEL, EMAILS, type Category, type Email } from "../domain/types";
import { storage } from "../runtime";
import type { ImportState, InboxData } from "../useInbox";
import { useSearchIds } from "../useInbox";
import { CategoryBadge } from "./CategoryBadge";
import { listDate, megabytes, plural } from "./format";

const PAGE = 300;

export type View = "inbox" | "drafts" | "banished";

export interface Filters {
  query: string;
  category: Category | "all" | "uncategorized";
  label: string;
  view: View;
}

export const EMPTY_FILTERS: Filters = { query: "", category: "all", label: "", view: "inbox" };

interface Props {
  data: InboxData;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  importer: ImportState;
  onPickFiles: () => void;
}

const sender = (e: Email) => e.from.name || e.from.address || "Unknown sender";

export const MailList = forwardRef<HTMLInputElement, Props>(function MailList(
  { data, filters, onFilters, selectedId, onSelect, importer, onPickFiles },
  searchRef,
) {
  const toast = useToast();
  const ids = useSearchIds(filters.view === "inbox" ? filters.query : "", data.version);
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  const shown = useMemo(() => {
    const base: Email[] =
      filters.view === "banished"
        ? data.banished
        : ids
          ? ids.map((id) => data.byId.get(id)).filter((e): e is Email => !!e && !e.banishedAt)
          : data.active;
    return base.filter(
      (e) =>
        (filters.category === "all" ||
          (filters.category === "uncategorized" ? !e.category : e.category === filters.category)) &&
        (!filters.label || e.labels.includes(filters.label)),
    );
  }, [data, ids, filters]);

  // Render a page of rows at a time: tens of thousands of rows would make every keystroke slow.
  const [pageSize, setPageSize] = useState(PAGE);
  useEffect(() => setPageSize(PAGE), [filters]);
  const visible = shown.slice(0, pageSize);

  const restore = async (list: string[]) => {
    const r = await restoreItems(storage, EMAILS, list);
    data.refresh();
    toast({ text: `Restored ${plural(r.restored.length, "email")}.`, tone: "ok" });
  };

  const filtering = filters.query !== "" || filters.category !== "all" || filters.label !== "";
  const title =
    filters.view === "drafts" ? "Drafts" : filters.view === "banished" ? "Banished" : "Inbox";

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title={title}
        actions={
          <Button size="sm" onClick={onPickFiles} disabled={importer.busy}>
            Import
          </Button>
        }
      />

      {filters.view === "inbox" && (
        <div className="space-y-2 border-b border-line p-3">
          <Input
            ref={searchRef}
            type="search"
            aria-label="Search mail"
            placeholder="Search mail…  /"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="filter-category">
              Category
            </label>
            <select
              id="filter-category"
              value={filters.category}
              onChange={(e) => set({ category: e.target.value as Filters["category"] })}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-xs text-fg"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
              <option value="uncategorized">Not sorted yet</option>
            </select>
            <label className="sr-only" htmlFor="filter-label">
              Label
            </label>
            <select
              id="filter-label"
              value={filters.label}
              onChange={(e) => set({ label: e.target.value })}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-xs text-fg"
            >
              <option value="">All labels</option>
              {data.labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {filtering && (
            <Button
              size="sm"
              variant="ghost"
              className="-ml-3"
              onClick={() => onFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {importer.progress && (
        <div className="border-b border-line px-3 py-2 text-xs text-muted" role="status">
          Reading {importer.progress.fileName}: {megabytes(importer.progress.bytes)} of{" "}
          {megabytes(importer.progress.total)} · {plural(importer.progress.added, "new email")}
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-raised">
            <div
              className="h-full bg-ecto transition-[width]"
              style={{
                width: `${importer.progress.total ? (100 * importer.progress.bytes) / importer.progress.total : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {importer.reports && (
        <div className="border-b border-line p-3 text-xs" role="status">
          {importer.reports.map((r) => (
            <div key={r.fileName} className="mb-2 last:mb-0">
              <p className="font-medium text-fg">{r.fileName}</p>
              {r.error ? (
                <p className="text-blood">{r.error}</p>
              ) : (
                r.counts && (
                  <p className="text-muted">
                    {plural(r.counts.added, "new email")}, {r.counts.duplicates} already here.
                  </p>
                )
              )}
              {r.skipped.length > 0 && (
                <details className="mt-1 text-muted">
                  <summary className="cursor-pointer text-candle">
                    Skipped {plural(r.skipped.length, "item")}
                  </summary>
                  <ul className="mt-1 list-disc pl-4">
                    {r.skipped.slice(0, 20).map((s) => (
                      <li key={s.where}>
                        {s.where}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" className="-ml-3 mt-1" onClick={importer.clearReports}>
            Dismiss
          </Button>
        </div>
      )}

      {filters.view === "drafts" ? (
        <>
          <p className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">
            {plural(data.drafts.length, "draft")}
          </p>
          <ul className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Drafts">
            {data.drafts.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect(d.emailId)}
                  aria-current={selectedId === d.emailId ? "true" : undefined}
                  className="w-full rounded-md px-3 py-2 text-left hover:bg-raised aria-[current=true]:bg-raised"
                >
                  <span className="block truncate text-sm text-fg">{d.subject}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    To {d.to} · not sent
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data.drafts.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No drafts. Ask the agent to draft a reply.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">
            <span aria-live="polite">{data.all ? plural(shown.length, "email") : "Loading…"}</span>
            {filters.view === "banished" && shown.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="-mr-2 normal-case tracking-normal"
                onClick={() => void restore(shown.map((e) => e.id))}
              >
                Restore all
              </Button>
            )}
          </div>
          <ul
            className="flex-1 overflow-y-auto px-2 pb-3"
            aria-label={filters.view === "banished" ? "Banished emails" : "Emails"}
          >
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  aria-current={selectedId === e.id ? "true" : undefined}
                  className={cn(
                    "group w-full rounded-md px-3 py-2 text-left hover:bg-raised",
                    "aria-[current=true]:bg-raised",
                  )}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg group-aria-[current=true]:text-ecto">
                      {sender(e)}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted">{listDate(e.date)}</span>
                  </span>
                  <span className="block truncate text-xs text-fg/90">{e.subject}</span>
                  {(e.category || e.labels.length > 0) && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {e.category && <CategoryBadge category={e.category} small />}
                      {e.labels.slice(0, 2).map((l) => (
                        <Badge key={l} className="px-1.5 py-0 text-[10px]">
                          {l}
                        </Badge>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {shown.length > visible.length && (
            <div className="px-3 pb-3">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => setPageSize((n) => n + PAGE)}
              >
                Show {Math.min(PAGE, shown.length - visible.length)} more of{" "}
                {shown.length - visible.length}
              </Button>
            </div>
          )}
          {data.all && shown.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {filters.view === "banished"
                ? "Nothing is banished."
                : data.active.length === 0
                  ? "No mail yet."
                  : "No mail matches."}
            </p>
          )}
        </>
      )}

      <nav aria-label="Views" className="flex border-t border-line p-2">
        {(
          [
            ["inbox", "Inbox", data.active.length],
            ["drafts", "Drafts", data.drafts.length],
            ["banished", "Banished", data.banished.length],
          ] as const
        ).map(([v, label, n]) => (
          <Button
            key={v}
            size="sm"
            variant="ghost"
            className={cn("flex-1", filters.view === v && "bg-raised text-fg")}
            aria-pressed={filters.view === v}
            onClick={() => onFilters({ ...EMPTY_FILTERS, view: v })}
          >
            {label} <span className="text-muted">{n}</span>
          </Button>
        ))}
      </nav>
    </div>
  );
});
