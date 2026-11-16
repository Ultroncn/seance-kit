import { restoreItems } from "@seance/core";
import {
  Badge,
  Button,
  GhostItem,
  GhostList,
  IconButton,
  Input,
  PaneHeader,
  Segmented,
  Select,
  cn,
  fieldClass,
  useT,
  useToast,
} from "@seance/ui";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, FileCheck2, Sparkles, Upload, X } from "lucide-react";
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
import { AutoImportDialog } from "./AutoImportDialog";
import { monthYear } from "./format";
import { SourceIcon } from "./SourceIcon";

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

  const [autoImportOpen, setAutoImportOpen] = useState(false);

  const restore = async (list: string[]) => {
    const r = await restoreItems(storage, CONVERSATIONS, list);
    data.refresh();
    toast({ text: t.restoredN(r.restored.length), tone: "ok" });
  };

  const handleAutoImportFiles = async (files: File[]) => {
    const started = await importer.importFiles(files);
    if (!started) {
      toast({ text: t.importBusy });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        title={filters.view === "banished" ? t.banished : t.library}
        actions={
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" disabled={importer.busy}>
                {t.import}
                <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-48 rounded-lg border border-line bg-raised p-1.5 shadow-popover"
              >
                <DropdownMenu.Item
                  onSelect={() => setAutoImportOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-surface-mid focus:bg-surface-mid"
                >
                  <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                  <span>一键导入</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={onPickFiles}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-surface-mid focus:bg-surface-mid"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  <span>本地文件导入</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        }
      />

      <AutoImportDialog
        open={autoImportOpen}
        onClose={() => setAutoImportOpen(false)}
        onFilesSelected={handleAutoImportFiles}
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
        <Segmented
          label={t.views}
          value={filters.view}
          onChange={(view) => onFilters({ ...EMPTY_FILTERS, view })}
          items={[
            { value: "active", label: t.all, count: data.active.length },
            { value: "banished", label: t.banished, count: data.banished.length },
          ]}
        />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="filter-source">
            {t.source}
          </label>
          <Select
            size="sm"
            id="filter-source"
            value={filters.source}
            onChange={(e) => set({ source: e.target.value as Filters["source"] })}
            className="min-w-0 flex-1"
          >
            <option value="all">{t.allSources}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                size="sm"
                variant={filters.from || filters.to ? "secondary" : "ghost"}
                aria-label={t.dateRange}
              >
                <CalendarDays aria-hidden />
                {filters.from || filters.to ? t.dateSet : t.date}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="z-50 w-64 space-y-3 rounded-lg border border-line bg-raised p-3 shadow-popover"
              >
                <p className="text-meta font-medium text-fg">{t.dateRange}</p>
                {(["from", "to"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-meta text-fg-2">
                    <span className="w-8 shrink-0">{k === "from" ? t.from : t.to}</span>
                    <input
                      id={`filter-${k}`}
                      type="date"
                      value={filters[k]}
                      onChange={(e) => set({ [k]: e.target.value })}
                      className={cn(fieldClass, "h-7 text-meta [color-scheme:dark]")}
                    />
                  </label>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
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
      </div>

      {importer.progress && (
        <div className="border-b border-line px-3 py-2 text-xs text-muted" role="status">
          {t.importing(importer.progress.done, importer.progress.total)}
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-raised">
            <div
              className="h-full bg-accent-solid transition-[width]"
              style={{
                width: `${importer.progress.total ? (100 * importer.progress.done) / importer.progress.total : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {importer.reports && (
        <div
          className="relative mx-3 mt-3 rounded-lg border border-line bg-raised p-3 pr-9 text-xs"
          role="status"
        >
          {importer.reports.map((r) => (
            <div key={r.fileName} className="mb-2 last:mb-0">
              <p className="flex items-center gap-1.5 truncate font-medium text-fg">
                <FileCheck2 aria-hidden className="size-3.5 shrink-0 text-success" />
                {r.fileName}
              </p>
              {r.error ? (
                <p className="text-danger">{r.error}</p>
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
                  <summary className="cursor-pointer text-warn">
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
          <IconButton
            aria-label={t.dismiss}
            size="sm"
            tooltip={false}
            className="absolute right-1 top-1"
            onClick={importer.clearReports}
          >
            <X />
          </IconButton>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs text-muted">
        <span aria-live="polite">{data.all ? t.chats(shown.length) : t.loading}</span>
        {filters.view === "banished" && shown.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2"
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
                "w-full rounded-md px-3 py-2 text-left transition-colors duration-100 hover:bg-raised",
                "aria-[current=true]:bg-raised",
              )}
            >
              <span className="block truncate text-sm font-medium text-fg">{c.title}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <SourceIcon source={c.source} />
                {monthYear(c.createdAt)} · {SOURCE_LABEL[c.source]}
                {c.summary && <span title={t.hasSummary}>· {t.summarized}</span>}
              </span>
              {c.tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {c.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
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
    </div>
  );
});
