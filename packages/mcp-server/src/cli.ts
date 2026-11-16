import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ToolRegistry } from "@seance/core";
import { importExportFile, parseExportFile, type Storage } from "@seance/storage";
import { FileStorage } from "@seance/storage/file";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";

/** What an app provides to run as an MCP server. */
export interface McpApp {
  name: string;
  version: string;
  instructions?: string;
  /** Build the app's tools over a storage. Called after Séance exports are imported. */
  setup(storage: Storage): Promise<{
    registry: ToolRegistry;
    /** Import a raw export file (e.g. conversations.json or an .mbox) with the app's importers. */
    ingest?: (path: string) => Promise<string>;
    /** Save pending work, e.g. the search index. */
    flush?: () => Promise<void>;
  }>;
}

export interface CliOptions {
  dataDir: string;
  imports: string[];
  readOnly: boolean;
}

const USAGE = `Options:
  --data <dir>      Folder for this app's data (created if missing). Required.
  --import <file>   Import before serving: a Séance export (Settings → Export all data)
                    or a raw export the app understands. Repeatable.
  --read-only       Expose only read tools.`;

/** Relative --data and --import paths resolve against `baseDir` (apps pass the repo root). */
export function parseCli(argv: string[], baseDir = process.cwd()): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      data: { type: "string" },
      import: { type: "string", multiple: true },
      "read-only": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (values.help || !values.data) throw new Error(USAGE);
  return {
    dataDir: resolve(baseDir, values.data),
    imports: (values.import ?? []).map((p) => resolve(baseDir, p)),
    readOnly: values["read-only"] ?? false,
  };
}

/** Logs go to stderr: stdout carries the MCP protocol. */
const log = (msg: string) => process.stderr.write(`[seance-mcp] ${msg}\n`);

async function isSeanceExport(path: string): Promise<string | null> {
  if (!/\.json$/i.test(path)) return null;
  const text = await readFile(path, "utf8");
  try {
    const data = JSON.parse(text) as { version?: unknown; collections?: unknown };
    return data.version === 1 && typeof data.collections === "object" ? text : null;
  } catch {
    return null;
  }
}

/**
 * Take `<dataDir>/.seance-mcp.lock` for this process. Two servers on one folder would overwrite
 * each other's writes. A lock left by a process that no longer runs is taken over.
 */
export async function acquireLock(dataDir: string): Promise<() => Promise<void>> {
  const path = join(dataDir, ".seance-mcp.lock");
  await mkdir(dataDir, { recursive: true });
  try {
    const pid = Number(await readFile(path, "utf8"));
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (alive)
        throw new Error(
          `Another Séance MCP server (pid ${pid}) is using ${dataDir}. Stop it or use another --data folder.`,
        );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await writeFile(path, String(process.pid), "utf8");
  return () => rm(path, { force: true });
}

/** Prepare storage and tools: imports first, then the app's setup. Exported for tests. */
export async function prepare(app: McpApp, opts: CliOptions) {
  const storage = new FileStorage(opts.dataDir);
  const raw: string[] = [];
  for (const path of opts.imports) {
    const text = await isSeanceExport(path);
    if (text) {
      const n = await importExportFile(storage, parseExportFile(text));
      log(`imported ${n} items from ${path}`);
    } else {
      raw.push(path);
    }
  }
  const tools = await app.setup(storage);
  for (const path of raw) {
    if (!tools.ingest)
      throw new Error(`${app.name} cannot import ${path}. Use a Séance export file.`);
    log(await tools.ingest(path));
  }
  await tools.flush?.();
  await storage.flush();
  return { storage, ...tools };
}

/** Entry point for an app's `mcp` script: parse flags, import, then serve over stdio. */
export async function runCli(
  app: McpApp,
  argv = process.argv.slice(2),
  baseDir = process.cwd(),
): Promise<void> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv, baseDir);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  let release: () => Promise<void>;
  try {
    release = await acquireLock(opts.dataDir);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    process.exit(3);
  }
  const { storage, registry, flush } = await prepare(app, opts);
  const server = createMcpServer({
    name: app.name,
    version: app.version,
    instructions: app.instructions,
    registry,
    storage,
    readOnly: opts.readOnly,
  });
  const shutdown = async () => {
    await flush?.();
    await storage.flush();
    await release();
    process.exit(0);
  };
  // Save shortly after every change too, so a killed process loses at most a moment of work.
  process.stdin.on("end", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  await server.connect(new StdioServerTransport());
  log(`${app.name} ready: data in ${opts.dataDir}${opts.readOnly ? ", read-only" : ""}`);
}
