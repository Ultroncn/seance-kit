import { MockProvider } from "@seance/llm";
import { IndexedDbStorage } from "@seance/storage";
import { tNow } from "@seance/ui";
import { archiveScripts } from "./demo/scripts";
import { createArchiveSearch } from "./domain/store";
import { archiveDemoMessages } from "./messages";
import type { FileLike } from "./importers";
import { createArchiveRegistry } from "./tools";

// Both apps share one origin, so each needs its own database name.
export const storage = new IndexedDbStorage({ name: "archive-seance" });
export const search = createArchiveSearch(storage);
export const registry = createArchiveRegistry({ search });
export const mock = new MockProvider({
  scripts: archiveScripts,
  unknownPromptText: () => tNow(archiveDemoMessages).unknown,
});

/** Resolves once the saved search index is restored or rebuilt. Never rejects: the list must load. */
export const searchReady: Promise<unknown> = search.load().catch((err: unknown) => {
  console.error("Search index could not be loaded, rebuilding", err);
  return search.rebuild().catch((e: unknown) => console.error("Search index rebuild failed", e));
});

// Save pending index changes when the tab goes away.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void search.flush());
}

export const toolContext = () => ({
  storage,
  signal: new AbortController().signal,
  now: () => new Date(),
});

export const SAMPLE_FILES = ["chatgpt-conversations.json", "claude-conversations.json"];
export const sampleUrl = (name: string) => `${import.meta.env.BASE_URL}sample/${name}`;

/** The bundled fictional archive, as files, so it goes through the same importer as a real export. */
export async function fetchSampleFiles(): Promise<FileLike[]> {
  return Promise.all(
    SAMPLE_FILES.map(async (name) => {
      const res = await fetch(sampleUrl(name));
      if (!res.ok) throw new Error(`Could not load the sample archive (HTTP ${res.status}).`);
      return new File([await res.blob()], name, { type: "application/json" });
    }),
  );
}
