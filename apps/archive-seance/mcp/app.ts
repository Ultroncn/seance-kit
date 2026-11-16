import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpApp } from "@seance/mcp-server";
import { createArchiveSearch, importConversations } from "../src/domain/store";
import { parseFile } from "../src/importers";
import { ARCHIVE_SYSTEM_PROMPT, createArchiveRegistry } from "../src/tools";

/** Archive Séance as an MCP server: the same six tools the browser agent uses. */
export const archiveMcp: McpApp = {
  name: "archive-seance",
  version: "0.1.0",
  instructions: ARCHIVE_SYSTEM_PROMPT,
  async setup(storage) {
    const search = createArchiveSearch(storage);
    await search.load();
    return {
      registry: createArchiveRegistry({ search }),
      flush: () => search.flush(),
      async ingest(path) {
        const name = basename(path);
        const parsed = await parseFile(new File([new Uint8Array(await readFile(path))], name));
        const c = await importConversations(storage, search, parsed.conversations);
        return `${name}: ${c.added} new, ${c.updated} updated, ${c.unchanged} already here, ${parsed.skipped.length} skipped`;
      },
    };
  },
};
