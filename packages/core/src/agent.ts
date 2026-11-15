import type { ChatMessage, Provider, ToolCall } from "@seance/llm";
import type { Storage } from "@seance/storage";
import type { ToolRegistry } from "./registry";
import type { Risk, ToolError, ToolErrorType } from "./types";

export type AgentEvent =
  | { type: "run_started"; runId: string }
  | { type: "step_started"; step: number }
  | { type: "message"; text: string }
  | { type: "tool_called"; callId: string; name: string; input: unknown; risk: Risk | null }
  | { type: "approval_requested"; callId: string; name: string; input: unknown; risk: Risk }
  | { type: "approval_resolved"; callId: string; approved: boolean }
  | {
      type: "tool_result";
      callId: string;
      name: string;
      ok: boolean;
      output?: unknown;
      error?: ToolError;
      durationMs: number;
      /** Set when a destructive tool returned `{ undoToken: string }`. */
      undoToken?: string;
    }
  | { type: "error"; code: "StepBudget" | "Provider" | "Aborted"; message: string }
  | { type: "run_finished"; reason: "complete" | "budget" | "error" | "aborted" };

export interface ApprovalRequest {
  callId: string;
  name: string;
  input: unknown;
  risk: Exclude<Risk, "read">;
}

/** Resolves true to allow the call, false to reject it. A throw counts as a rejection. */
export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean> | boolean;

export interface AgentOptions {
  provider: Provider;
  registry: ToolRegistry;
  storage: Storage;
  system?: string;
  /** Maximum tool calls per run. Default 8. */
  maxSteps?: number;
  now?: () => Date;
}

export interface RunOptions {
  /** Without a handler every non-read tool is rejected. Safe by default. */
  approve?: ApprovalHandler;
  signal?: AbortSignal;
}

export const DEFAULT_MAX_STEPS = 8;

function errorContent(error: ToolError): string {
  return JSON.stringify({ error });
}

/**
 * The agent loop. One instance holds one conversation.
 *
 * Invariants (property-tested):
 * - At most `maxSteps` tool calls run per `run`.
 * - A tool whose risk is not `read` never runs without an approval for that exact call.
 * - Invalid tool input is returned to the model as a typed error and never reaches the tool.
 */
export class Agent {
  private history: ChatMessage[] = [];
  private runCount = 0;

  constructor(private readonly options: AgentOptions) {}

  get messages(): readonly ChatMessage[] {
    return this.history;
  }

  /** Start a fresh conversation. */
  reset(): void {
    this.history = [];
  }

  async *run(userMessage: string, runOptions: RunOptions = {}): AsyncGenerator<AgentEvent> {
    const { provider, registry, storage } = this.options;
    const now = this.options.now ?? (() => new Date());
    const maxSteps = Math.max(0, Math.floor(this.options.maxSteps ?? DEFAULT_MAX_STEPS));
    const signal = runOptions.signal ?? new AbortController().signal;

    yield { type: "run_started", runId: `run-${++this.runCount}` };
    this.history.push({ role: "user", content: userMessage });

    let steps = 0;
    let turn = 0;
    for (;;) {
      if (signal.aborted) {
        yield { type: "error", code: "Aborted", message: "Run cancelled" };
        yield { type: "run_finished", reason: "aborted" };
        return;
      }

      yield { type: "step_started", step: ++turn };
      let reply;
      try {
        reply = await provider.complete({
          messages: this.history,
          tools: registry.toJsonSchema(),
          system: this.options.system,
          signal,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield { type: "error", code: "Provider", message };
        yield { type: "run_finished", reason: "error" };
        return;
      }

      this.history.push({
        role: "assistant",
        content: reply.text,
        ...(reply.toolCalls.length > 0 ? { toolCalls: reply.toolCalls } : {}),
      });
      if (reply.text !== "") yield { type: "message", text: reply.text };
      if (reply.toolCalls.length === 0) {
        yield { type: "run_finished", reason: "complete" };
        return;
      }

      let budgetHit = false;
      for (const call of reply.toolCalls) {
        if (budgetHit || steps >= maxSteps) {
          // Every tool call needs a result in the history, or providers reject the next request.
          if (!budgetHit) {
            budgetHit = true;
            yield {
              type: "error",
              code: "StepBudget",
              message: `Step budget of ${maxSteps} tool calls reached`,
            };
          }
          this.pushResult(call, {
            type: "StepBudget",
            message: "Not run: step budget exhausted",
          });
          continue;
        }
        steps++;
        yield* this.runCall(call, runOptions, { registry, storage, now, signal });
      }
      if (budgetHit) {
        yield { type: "run_finished", reason: "budget" };
        return;
      }
    }
  }

  private pushResult(call: ToolCall, error: ToolError): void {
    this.history.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: errorContent(error),
      isError: true,
    });
  }

  private async *runCall(
    call: ToolCall,
    runOptions: RunOptions,
    env: {
      registry: ToolRegistry;
      storage: Storage;
      now: () => Date;
      signal: AbortSignal;
    },
  ): AsyncGenerator<AgentEvent> {
    const { registry, storage, now, signal } = env;
    const started = Date.now();
    const tool = registry.get(call.name);
    yield {
      type: "tool_called",
      callId: call.id,
      name: call.name,
      input: call.input,
      risk: tool?.risk ?? null,
    };

    const fail = (type: ToolErrorType, message: string): AgentEvent => {
      const error: ToolError = { type, message };
      this.pushResult(call, error);
      return {
        type: "tool_result",
        callId: call.id,
        name: call.name,
        ok: false,
        error,
        durationMs: Date.now() - started,
      };
    };

    // 1. Validate. Invalid input never reaches approval or the tool.
    const parsed = registry.parseInput(call.name, call.input);
    if (!parsed.ok) {
      yield fail(parsed.error.type, parsed.error.message);
      return;
    }
    const { tool: validTool, input } = parsed.value;

    // 2. Gate. Anything that is not read waits for an explicit yes for this exact call.
    if (validTool.risk !== "read") {
      const request: ApprovalRequest = {
        callId: call.id,
        name: call.name,
        input,
        risk: validTool.risk,
      };
      yield { type: "approval_requested", ...request };
      let approved = false;
      try {
        approved = (await runOptions.approve?.(request)) === true;
      } catch {
        approved = false;
      }
      yield { type: "approval_resolved", callId: call.id, approved };
      if (!approved) {
        yield fail("Rejected", "The user rejected this action");
        return;
      }
    }

    // 3. Run.
    const result = await registry.execute(validTool, input, { storage, signal, now });
    if (!result.ok) {
      yield fail(result.error.type, result.error.message);
      return;
    }
    const output = result.value;
    this.history.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify(output) ?? "null",
    });
    const undoToken =
      validTool.risk === "destructive" &&
      typeof output === "object" &&
      output !== null &&
      typeof (output as { undoToken?: unknown }).undoToken === "string"
        ? (output as { undoToken: string }).undoToken
        : undefined;
    yield {
      type: "tool_result",
      callId: call.id,
      name: call.name,
      ok: true,
      output,
      durationMs: Date.now() - started,
      ...(undoToken ? { undoToken } : {}),
    };
  }
}

export function createAgent(options: AgentOptions): Agent {
  return new Agent(options);
}
