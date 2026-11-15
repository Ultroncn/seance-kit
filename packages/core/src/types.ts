import type { Storage } from "@seance/storage";
import type { z } from "zod";

/**
 * read: no side effects. write: changes stored data. destructive: removes or hides data.
 * Anything that is not `read` needs user approval before it runs.
 */
export type Risk = "read" | "write" | "destructive";

export interface ToolContext {
  storage: Storage;
  signal: AbortSignal;
  now(): Date;
}

export interface Tool<I, O> {
  /** snake_case, unique within a registry. */
  name: string;
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  risk: Risk;
  run(input: I, ctx: ToolContext): Promise<O>;
}

/** A registered tool with its types erased. Create one with `defineTool`. */
export interface AnyTool {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType;
  readonly output: z.ZodType;
  readonly risk: Risk;
  run(input: unknown, ctx: ToolContext): Promise<unknown>;
}

export type ToolErrorType =
  | "UnknownTool"
  | "InvalidInput"
  | "InvalidOutput"
  | "ToolFailed"
  | "Rejected"
  | "StepBudget"
  | "Aborted";

export interface ToolError {
  type: ToolErrorType;
  message: string;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ToolError };
