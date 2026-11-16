import { MockProvider } from "@seance/llm";
import { IndexedDbStorage } from "@seance/storage";
import { inboxScripts } from "./demo/scripts";
import { createInboxSearch } from "./domain/store";
import type { FileLike } from "./importers";
import { createInboxRegistry } from "./tools";

// Both apps share one origin, so each needs its own database name.
export const storage = new IndexedDbStorage({ name: "inbox-exorcist" });
export const search = createInboxSearch(storage);
export const registry = createInboxRegistry({ search });
export const mock = new MockProvider({ scripts: inboxScripts });
export const searchReady = search.load();

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void search.flush());
}

export const toolContext = () => ({
  storage,
  signal: new AbortController().signal,
  now: () => new Date(),
});

export const SAMPLE_FILE = "inbox.mbox";
export const sampleUrl = () => `${import.meta.env.BASE_URL}sample/${SAMPLE_FILE}`;

/** The bundled fictional inbox, as a file, so it goes through the same importer as a real export. */
export async function fetchSampleFile(): Promise<FileLike> {
  const res = await fetch(sampleUrl());
  if (!res.ok) throw new Error(`Could not load the sample inbox (HTTP ${res.status}).`);
  return new File([await res.blob()], SAMPLE_FILE, { type: "application/mbox" });
}
