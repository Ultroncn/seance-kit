import { isBanished } from "@seance/core";
import { tNow } from "@seance/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importConversations, type ImportCounts } from "./domain/store";
import { CONVERSATIONS, type Conversation } from "./domain/types";
import { ImportError, parseFile, type FileLike, type SkippedItem } from "./importers";
import { archiveMessages } from "./messages";
import { search, searchReady, storage } from "./runtime";

export interface ArchiveData {
  /** null while loading. */
  all: Conversation[] | null;
  active: Conversation[];
  banished: Conversation[];
  byId: Map<string, Conversation>;
  /** Bumps after every change. Effects that read storage depend on it. */
  version: number;
  refresh: () => void;
}

export function useArchive(): ArchiveData {
  const [all, setAll] = useState<Conversation[] | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void searchReady
      .then(() => storage.list<Conversation>(CONVERSATIONS))
      .then((list) => {
        if (live) setAll(list);
      });
    return () => {
      live = false;
    };
  }, [version]);

  return useMemo(() => {
    const list = all ?? [];
    const newestFirst = (a: Conversation, b: Conversation) =>
      b.createdAt.localeCompare(a.createdAt);
    return {
      all,
      active: list.filter((c) => !isBanished(c)).sort(newestFirst),
      banished: list.filter(isBanished).sort(newestFirst),
      byId: new Map(list.map((c) => [c.id, c])),
      version,
      refresh,
    };
  }, [all, version, refresh]);
}

/** Search results as ids in rank order, or null when the query is empty. */
export function useSearchIds(query: string, version: number): string[] | null {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q === "") {
      setIds(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      void searchReady
        // Banished chats are filtered by the caller. Skip the per-hit check and keep every hit,
        // so source and date filters see all matches, not just the top few hundred.
        .then(() => search.search(q, { limit: 100_000, includeBanished: true }))
        .then((hits) => {
          if (live) setIds(hits.map((h) => h.id));
        });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, version]);
  return ids;
}

export interface FileReport {
  fileName: string;
  counts?: ImportCounts;
  skipped: SkippedItem[];
  error?: string;
}

export interface ImportState {
  busy: boolean;
  progress: { done: number; total: number } | null;
  reports: FileReport[] | null;
  /** False when nothing was imported because another import is still running. */
  importFiles: (files: FileLike[]) => Promise<boolean>;
  clearReports: () => void;
}

/** Parse and store dropped or picked files, one at a time, with progress and a per-file report. */
export function useImporter(onDone: () => void): ImportState {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [reports, setReports] = useState<FileReport[] | null>(null);

  const running = useRef(false);
  const importFiles = useCallback(
    async (files: FileLike[]) => {
      // One import at a time. Drag-and-drop or the palette can ask while one is running.
      if (files.length === 0 || running.current) return false;
      running.current = true;
      setBusy(true);
      setReports(null);
      const out: FileReport[] = [];
      try {
        await searchReady;
        for (const file of files) {
          try {
            const parsed = await parseFile(file);
            setProgress({ done: 0, total: parsed.conversations.length });
            const counts = await importConversations(
              storage,
              search,
              parsed.conversations,
              (done, total) => setProgress({ done, total }),
            );
            out.push({ fileName: file.name, counts, skipped: parsed.skipped });
          } catch (err) {
            const message =
              err instanceof ImportError || err instanceof Error ? err.message : String(err);
            out.push({ fileName: file.name, skipped: [], error: message });
          }
        }
        await search.flush().catch((err: unknown) =>
          out.push({
            fileName: tNow(archiveMessages).indexFile,
            skipped: [],
            error: tNow(archiveMessages).indexNotSaved(
              err instanceof Error ? err.message : String(err),
            ),
          }),
        );
      } finally {
        running.current = false;
        setProgress(null);
        setReports(out);
        setBusy(false);
        onDone();
      }
      return true;
    },
    [onDone],
  );

  return {
    busy,
    progress,
    reports,
    importFiles,
    clearReports: useCallback(() => setReports(null), []),
  };
}
