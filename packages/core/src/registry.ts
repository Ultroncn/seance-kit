import type { ToolSpec } from "@seance/llm";
import { z } from "zod";
import type { AnyTool, Outcome, Risk, Tool, ToolContext } from "./types";

const NAME_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const RISKS: readonly Risk[] = ["read", "write", "destructive"];

/** Erase a tool's input and output types so tools of different shapes can share a registry. */
export function defineTool<I, O>(tool: Tool<I, O>): AnyTool {
  return {
    name: tool.name,
    description: tool.description,
    input: tool.input,
    output: tool.output,
    risk: tool.risk,
    // Safe: the registry only calls `run` with input that `tool.input` has already parsed.
    run: (input, ctx) => tool.run(input as I, ctx),
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean };
}

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.length > 0 ? i.path.join(".") : "(input)"}: ${i.message}`)
    .join("; ");
}

export class ToolRegistry {
  private readonly tools = new Map<string, AnyTool>();

  register(tool: AnyTool): this {
    if (!NAME_RE.test(tool.name)) {
      throw new Error(`Invalid tool name "${tool.name}": use snake_case`);
    }
    if (!RISKS.includes(tool.risk)) throw new Error(`Invalid risk for tool "${tool.name}"`);
    if (tool.description.trim() === "") throw new Error(`Tool "${tool.name}" needs a description`);
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  list(): AnyTool[] {
    return [...this.tools.values()];
  }

  /** Tool definitions in the shape providers expect. */
  toJsonSchema(): ToolSpec[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: jsonSchemaOf(t.input),
    }));
  }

  /** Tool definitions for the MCP server, derived from the same schemas. */
  toMcpTools(): McpToolDefinition[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: jsonSchemaOf(t.input),
      annotations: { readOnlyHint: t.risk === "read", destructiveHint: t.risk === "destructive" },
    }));
  }

  /** Look up a tool and validate raw model input. Never throws. */
  parseInput(name: string, raw: unknown): Outcome<{ tool: AnyTool; input: unknown }> {
    const tool = this.tools.get(name);
    if (!tool)
      return { ok: false, error: { type: "UnknownTool", message: `No tool named "${name}"` } };
    let parsed;
    try {
      parsed = tool.input.safeParse(raw);
    } catch (err) {
      return { ok: false, error: { type: "InvalidInput", message: errorMessage(err) } };
    }
    if (!parsed.success) {
      return { ok: false, error: { type: "InvalidInput", message: describeIssues(parsed.error) } };
    }
    return { ok: true, value: { tool, input: parsed.data } };
  }

  /** Run a tool with already validated input and check its output. Never throws. */
  async execute(tool: AnyTool, input: unknown, ctx: ToolContext): Promise<Outcome<unknown>> {
    let output: unknown;
    try {
      output = await tool.run(input, ctx);
    } catch (err) {
      return { ok: false, error: { type: "ToolFailed", message: errorMessage(err) } };
    }
    let checked;
    try {
      checked = tool.output.safeParse(output);
    } catch (err) {
      return { ok: false, error: { type: "InvalidOutput", message: errorMessage(err) } };
    }
    if (!checked.success) {
      return {
        ok: false,
        error: { type: "InvalidOutput", message: describeIssues(checked.error) },
      };
    }
    return { ok: true, value: checked.data };
  }

  /**
   * Validate then run, with no approval step. For trusted callers such as tests and the MCP
   * server (whose client asks the user). The agent loop does NOT use this: it gates first.
   */
  async run(name: string, raw: unknown, ctx: ToolContext): Promise<Outcome<unknown>> {
    const parsed = this.parseInput(name, raw);
    if (!parsed.ok) return parsed;
    return this.execute(parsed.value.tool, parsed.value.input, ctx);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
