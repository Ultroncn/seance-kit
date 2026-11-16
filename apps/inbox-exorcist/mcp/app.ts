import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpApp } from "@seance/mcp-server";
import { createInboxSearch, importEmails } from "../src/domain/store";
import type { NormalizedEmail } from "../src/domain/types";
import { readEmails } from "../src/importers";
import { INBOX_SYSTEM_PROMPT, createInboxRegistry } from "../src/tools";

/** Inbox Exorcist as an MCP server: the same tools the browser agent uses, none of which can send mail. */
export const inboxMcp: McpApp = {
  name: "inbox-exorcist",
  version: "0.1.0",
  instructions: INBOX_SYSTEM_PROMPT,
  async setup(storage) {
    const search = createInboxSearch(storage);
    await search.load();
    return {
      registry: createInboxRegistry({ search }),
      flush: () => search.flush(),
      async ingest(path) {
        const name = basename(path);
        const file = new File([new Uint8Array(await readFile(path))], name);
        let skipped = 0;
        async function* emails(): AsyncGenerator<NormalizedEmail> {
          for await (const ev of readEmails(file)) {
            if (ev.kind === "email") yield ev.email;
            if (ev.kind === "skipped") skipped++;
          }
        }
        const c = await importEmails(storage, search, emails());
        return `${name}: ${c.added} new, ${c.duplicates} already here, ${skipped} skipped`;
      },
    };
  },
};
