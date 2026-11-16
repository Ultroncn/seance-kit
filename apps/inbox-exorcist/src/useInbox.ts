import { isBanished } from "@seance/core";
import { tNow } from "@seance/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importEmails, type ImportCounts } from "./domain/store";
import { DRAFTS, EMAILS, type Draft, type Email, type NormalizedEmail } from "./domain/types";
import { ImportError, readEmails, type FileLike, type SkippedItem } from "./importers";
import { inboxMessages } from "./messages";
import { search, searchReady, storage } from "./runtime";

export interface InboxData {
  all: Email[] | null;
  active: Email[];
  banished: Email[];
  drafts: Draft[];
  byId: Map<string, Email>;
  labels: string[];
  /** Every mailbox address seen, sorted. More than one means mail from several accounts. */
  mailboxes: string[];
  version: number;
  refresh: () => void;
}

export function useInbox(): InboxData {
  const [all, setAll] = useState<Email[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void searchReady
      .then(() => Promise.all([storage.list<Email>(EMAILS), storage.list<Draft>(DRAFTS)]))
      .then(([emails, ds]) => {
        if (!live) return;
        setAll(emails);
        setDrafts(ds.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      });
    return () => {
      live = false;
    };
  }, [version]);

  return useMemo(() => {
    const list = all ?? [];
    const newest = (a: Email, b: Email) => b.date.localeCompare(a.date);
    return {
      all,
      active: list.filter((e) => !isBanished(e)).sort(newest),
      banished: list.filter(isBanished).sort(newest),
      drafts,
      byId: new Map(list.map((e) => [e.id, e])),
      labels: [...new Set(list.flatMap((e) => e.labels))].sort(),
      mailboxes: [...new Set(list.flatMap((e) => (e.mailbox ? [e.mailbox] : [])))].sort(),
      version,
      refresh,
    };
  }, [all, drafts, version, refresh]);
}

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
        // Banished mail is filtered by the caller. Keep every hit so filters see all matches.
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

export interface ImportProgress {
  fileName: string;
  bytes: number;
  total: number;
  added: number;
}

export interface ImportState {
  busy: boolean;
  progress: ImportProgress | null;
  reports: FileReport[] | null;
  /** False when nothing was imported because another import is still running. */
  importFiles: (files: FileLike[]) => Promise<boolean>;
  clearReports: () => void;
}

/** Stream each file through the mbox/eml reader into storage, with byte progress and a report. */
export function useImporter(onDone: () => void): ImportState {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
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
          const skipped: SkippedItem[] = [];
          let state: ImportProgress = { fileName: file.name, bytes: 0, total: file.size, added: 0 };
          setProgress(state);
          async function* emails(): AsyncGenerator<NormalizedEmail> {
            for await (const ev of readEmails(file)) {
              if (ev.kind === "email") yield ev.email;
              else if (ev.kind === "skipped") skipped.push(ev.item);
              else {
                state = { ...state, bytes: ev.bytes, total: ev.total };
                setProgress(state);
              }
            }
          }
          try {
            const counts = await importEmails(storage, search, emails(), (c) => {
              state = { ...state, added: c.added };
              setProgress(state);
            });
            out.push({ fileName: file.name, counts, skipped });
          } catch (err) {
            out.push({
              fileName: file.name,
              skipped,
              error: err instanceof ImportError || err instanceof Error ? err.message : String(err),
            });
          }
        }
        await search.flush().catch((err: unknown) =>
          out.push({
            fileName: tNow(inboxMessages).indexFile,
            skipped: [],
            error: tNow(inboxMessages).indexNotSaved(
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
