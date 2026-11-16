import { restoreItems } from "@seance/core";
import { Badge, Button, Input, PaneHeader, cn, useToast } from "@seance/ui";
import { forwardRef, useEffect, useMemo, useState } from "react";
import {
  CONVERSATIONS,
  SOURCES,
  SOURCE_LABEL,
  type Conversation,
  type Source,
} from "../domain/types";
import { storage } from "../runtime";
import type { ArchiveData, ImportState } from "../useArchive";
import { useSearchIds } from "../useArchive";
import { monthYear, plural } from "./format";

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
    toast({ text: `Restored ${plural(r.restored.length, "chat")}.`, tone: "ok" });
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title={filters.view === "banished" ? "Banished" : "Library"}
        actions={
          <Button size="sm" onClick={onPickFiles} disabled={importer.busy}>
            Import
          </Button>
        }
      />

      <div className="space-y-2 border-b border-line p-3">
        <Input
          ref={searchRef}
          type="search"
          aria-label="Search chats"
          placeholder="Search chats…  /"
          value={filters.query}
          disabled={filters.view === "banished"}
          onChange={(e) => set({ query: e.target.value })}
        />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="filter-source">
            Source
          </label>
          <select
            id="filter-source"
            value={filters.source}
            onChange={(e) => set({ source: e.target.value as Filters["source"] })}
            className="h-8 flex-1 rounded-md border border-line bg-surface px-2 text-xs text-fg"
          >
            <option value="all">All sources</option>
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
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 text-xs text-fg [color-scheme:dark]"
          />
          <label htmlFor="filter-to">to</label>
          <input
            id="filter-to"
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 text-xs text-fg [color-scheme:dark]"
          />
        </div>
      </div>

      {importer.progress && (
        <div className="border-b border-line px-3 py-2 text-xs text-muted" role="status">
          Importing {importer.progress.done} of {importer.progress.total}…
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
                    {plural(r.counts.added, "new chat")}, {r.counts.updated} updated,{" "}
                    {r.counts.unchanged} already here.
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
                        {s.where}
                        {s.title ? ` “${s.title}”` : ""}: {s.reason}
                      </li>
                    ))}
                  </ul>
                  {data.all && shown.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-muted">
                      {filters.view === "banished"
                        ? "Nothing is banished."
                        : data.active.length === 0
                          ? "No chats yet."
                          : "No chats match."}
                    </p>
                  )}
                </details>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" className="-ml-3 mt-1" onClick={importer.clearReports}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">
        <span aria-live="polite">{data.all ? plural(shown.length, "chat") : "Loading…"}</span>
        {filters.view === "banished" && shown.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2 normal-case tracking-normal"
            onClick={() => void restore(shown.map((c) => c.id))}
          >
            Restore all
          </Button>
        )}
      </div>

      <ul
        className="flex-1 overflow-y-auto px-2 pb-3"
        aria-label={filters.view === "banished" ? "Banished chats" : "Chats"}
      >
        {visible.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selectedId === c.id ? "true" : undefined}
              className={cn(
                "group w-full rounded-md px-3 py-2 text-left hover:bg-raised",
                "aria-[current=true]:bg-raised",
              )}
            >
              <span className="block truncate text-sm text-fg group-aria-[current=true]:text-ecto">
                {c.title}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                {monthYear(c.createdAt)} · {SOURCE_LABEL[c.source]}
                {c.summary && <span title="Has a summary">· summarized</span>}
              </span>
              {c.tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {c.tags.slice(0, 3).map((t) => (
                    <Badge key={t} className="px-1.5 py-0 text-[10px]">
                      {t}
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
          <span>{filters.view === "banished" ? "← Back to library" : "Banished"}</span>
          {filters.view === "active" && <span className="text-muted">{data.banished.length}</span>}
        </Button>
      </div>
    </div>
  );
});
