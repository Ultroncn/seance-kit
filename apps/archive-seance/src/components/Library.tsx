import { restoreItems } from "@seance/core";
import {
  Badge,
  Button,
  GhostItem,
  GhostList,
  Input,
  PaneHeader,
  cn,
  useT,
  useToast,
} from "@seance/ui";
import { forwardRef, useEffect, useMemo, useState } from "react";
import {
  CONVERSATIONS,
  SOURCES,
  SOURCE_LABEL,
  type Conversation,
  type Source,
} from "../domain/types";
import { archiveMessages } from "../messages";
import { storage } from "../runtime";
import type { ArchiveData, ImportState } from "../useArchive";
import { useSearchIds } from "../useArchive";
import { monthYear } from "./format";

const PAGE = 300;

export interface Filters {
  query: string;
  source: Source | "all";
  from: string;
  to: string;
  view: "active" | "banished";
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  source: "all",
  from: "",
  to: "",
  view: "active",
};

interface Props {
  data: ArchiveData;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  importer: ImportState;
  onPickFiles: () => void;
}

export const Library = forwardRef<HTMLInputElement, Props>(function Library(
  { data, filters, onFilters, selectedId, onSelect, importer, onPickFiles },
  searchRef,
) {
  const toast = useToast();
  const t = useT(archiveMessages);
  const ids = useSearchIds(filters.view === "active" ? filters.query : "", data.version);
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  const shown = useMemo(() => {
    const base: Conversation[] =
      filters.view === "banished"
        ? data.banished
        : ids
          ? ids
              .map((id) => data.byId.get(id))
              .filter((c): c is Conversation => !!c && !c.banishedAt)
          : data.active;
    return base.filter((c) => {
      const d = c.createdAt.slice(0, 10);
      return (
        (filters.source === "all" || c.source === filters.source) &&
        (!filters.from || d >= filters.from) &&
        (!filters.to || d <= filters.to)
      );
    });
  }, [data, ids, filters]);

  const filtering =
    filters.query !== "" || filters.source !== "all" || filters.from !== "" || filters.to !== "";

  // Render a page of rows at a time: tens of thousands of rows would make every keystroke slow.
  const [pageSize, setPageSize] = useState(PAGE);
  useEffect(() => setPageSize(PAGE), [filters]);
  const visible = shown.slice(0, pageSize);

  const restore = async (list: string[]) => {
    const r = await restoreItems(storage, CONVERSATIONS, list);
    data.refresh();
    toast({ text: t.restoredN(r.restored.length), tone: "ok" });
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title={filters.view === "banished" ? t.banished : t.library}
        actions={
          <Button size="sm" onClick={onPickFiles} disabled={importer.busy}>
            {t.import}
          </Button>
        }
      />

      <div className="space-y-2 border-b border-line p-3">
        <Input
          ref={searchRef}
          type="search"
          aria-label={t.searchChats}
          placeholder={t.searchPlaceholder}
          value={filters.query}
          disabled={filters.view === "banished"}
          onChange={(e) => set({ query: e.target.value })}
        />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="filter-source">
            {t.source}
          </label>
          <select
            id="filter-source"
            value={filters.source}
            onChange={(e) => set({ source: e.target.value as Filters["source"] })}
            className="h-8 flex-1 rounded-md border border-edge bg-surface px-2 text-xs text-fg"
          >
            <option value="all">{t.allSources}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          {filtering && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onFilters({ ...EMPTY_FILTERS, view: filters.view })}
            >
              {t.clear}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <label htmlFor="filter-from">{t.from}</label>
          <input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md border border-edge bg-surface px-1.5 text-xs text-fg [color-scheme:dark]"
          />
          <label htmlFor="filter-to">{t.to}</label>
          <input
            id="filter-to"
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md border border-edge bg-surface px-1.5 text-xs text-fg [color-scheme:dark]"
          />
        </div>
      </div>

      {importer.progress && (
        <div className="border-b border-line px-3 py-2 text-xs text-muted" role="status">
          {t.importing(importer.progress.done, importer.progress.total)}
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-raised">
            <div
              className="h-full bg-ecto transition-[width]"
              style={{
                width: `${importer.progress.total ? (100 * importer.progress.done) / importer.progress.total : 0}%`,
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
                    {t.importCounts(r.counts.added, r.counts.updated, r.counts.unchanged)}
                    {r.counts.older > 0 && t.keptNewer(r.counts.older)}
                  </p>
                )
              )}
              {r.skipped.length > 0 && (
                <details className="mt-1 text-muted">
                  <summary className="cursor-pointer text-candle">
                    {t.skipped(r.skipped.length)}
                  </summary>
                  <ul className="mt-1 list-disc pl-4">
                    {r.skipped.slice(0, 20).map((s) => (
                      <li key={s.where}>
                        {s.where}
                        {s.title ? ` “${s.title}”` : ""}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" className="-ml-3 mt-1" onClick={importer.clearReports}>
            {t.dismiss}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">
        <span aria-live="polite">{data.all ? t.chats(shown.length) : t.loading}</span>
        {filters.view === "banished" && shown.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2 normal-case tracking-normal"
            onClick={() => void restore(shown.map((c) => c.id))}
          >
            {t.restoreAll}
          </Button>
        )}
      </div>

      <GhostList
        key={[filters.view, filters.query, filters.source, filters.from, filters.to].join("\u0000")}
        className="flex-1 overflow-y-auto px-2 pb-3"
        aria-label={filters.view === "banished" ? t.banishedChats : t.chatsList}
      >
        {visible.map((c) => (
          <GhostItem key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selectedId === c.id ? "true" : undefined}
              className={cn(
                "group w-full rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-raised/70 relative before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ecto before:opacity-0 before:transition-opacity before:duration-150 aria-[current=true]:before:opacity-100",
                "aria-[current=true]:bg-raised",
              )}
            >
              <span className="block truncate text-sm text-fg group-aria-[current=true]:text-ecto">
                {c.title}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                {monthYear(c.createdAt)} · {SOURCE_LABEL[c.source]}
                {c.summary && <span title={t.hasSummary}>· {t.summarized}</span>}
              </span>
              {c.tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {c.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} className="px-1.5 py-0 text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </span>
              )}
            </button>
          </GhostItem>
        ))}
      </GhostList>
      {data.all && shown.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted">
          {filters.view === "banished"
            ? t.nothingBanished
            : data.active.length === 0
              ? t.noChats
              : t.noMatch}
        </p>
      )}
      {shown.length > visible.length && (
        <div className="px-3 pb-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => setPageSize((n) => n + PAGE)}
          >
            {t.showMore(
              Math.min(PAGE, shown.length - visible.length),
              shown.length - visible.length,
            )}
          </Button>
        </div>
      )}

      <div className="border-t border-line p-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between"
          aria-pressed={filters.view === "banished"}
          onClick={() =>
            set({ view: filters.view === "banished" ? "active" : "banished", query: "" })
          }
        >
          <span>{filters.view === "banished" ? t.backToLibrary : t.banished}</span>
          {filters.view === "active" && <span className="text-muted">{data.banished.length}</span>}
        </Button>
      </div>
    </div>
  );
});
