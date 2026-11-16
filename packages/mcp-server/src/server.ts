import type { ToolRegistry } from "@seance/core";
import type { Storage } from "@seance/storage";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

export interface McpServerOptions {
  name: string;
  version: string;
  /** Shown to the MCP client, e.g. Kiro, as guidance for the model. */
  instructions?: string;
  registry: ToolRegistry;
  storage: Storage;
  /** Expose only tools with risk "read". */
  readOnly?: boolean;
  now?: () => Date;
}

/**
 * An MCP server over a Séance Kit tool registry. Tool names, descriptions, input and output
 * schemas come straight from the registry, the same definitions the browser agent uses (R9.3).
 * Risk becomes MCP annotations, so the client can ask before write and destructive tools.
 */
export function createMcpServer(o: McpServerOptions): Server {
  const now = o.now ?? (() => new Date());
  const visible = () =>
    o.registry.toMcpTools().filter((t) => !o.readOnly || t.annotations.readOnlyHint);

  const server = new Server(
    { name: o.name, version: o.version },
    { capabilities: { tools: {} }, ...(o.instructions ? { instructions: o.instructions } : {}) },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: visible() }));

  // One tool call at a time. Tools read, then write; two at once could overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  server.setRequestHandler(CallToolRequestSchema, (req, extra): Promise<CallToolResult> =>
    serial(async () => {
      const name = req.params.name;
      const def = visible().find((t) => t.name === name);
      if (!def) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `UnknownTool: no tool named "${name}"${o.readOnly ? " in read-only mode" : ""}`,
            },
          ],
        };
      }
      const out = await o.registry.run(name, req.params.arguments ?? {}, {
        storage: o.storage,
        signal: extra.signal,
        now,
      });
      if (!out.ok)
        return {
          isError: true,
          content: [{ type: "text", text: `${out.error.type}: ${out.error.message}` }],
        };
      const text = JSON.stringify(out.value, null, 2) ?? "null";
      return {
        content: [{ type: "text", text }],
        ...(def.outputSchema ? { structuredContent: out.value as Record<string, unknown> } : {}),
      };
    }),
  );

  return server;
}
