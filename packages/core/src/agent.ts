import type { ChatMessage, Provider, ToolCall } from "@seance/llm";
import type { Storage } from "@seance/storage";
import type { ToolRegistry } from "./registry";
import { withDeltas } from "./stream";
import type { Risk, ToolError, ToolErrorType } from "./types";

export type AgentEvent =
  | { type: "run_started"; runId: string; prompt: string }
  | { type: "step_started"; step: number }
  | { type: "message"; text: string }
  /** A piece of the reply as the model writes it. `message` follows with the whole text. */
  | { type: "message_delta"; text: string }
  /** A piece of the model's reasoning, where its API shares it. */
  | { type: "reasoning_delta"; text: string }
  /** The step's whole reasoning and how long the model thought, sent once the reply is in. */
  | { type: "reasoning"; text: string; durationMs: number }
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
 * - Every tool call in the history gets exactly one result, and call ids are unique.
 * - A run only ever writes to the history it started with, so `reset()` mid-run is safe.
 */
export class Agent {
  private history: ChatMessage[] = [];
  private seenCallIds = new Set<string>();
  private runCount = 0;

  constructor(private readonly options: AgentOptions) {}

  get messages(): readonly ChatMessage[] {
    return this.history;
  }

  /** Start a fresh conversation. */
  reset(): void {
    // A run still in flight keeps writing to its own (old) array, never to the new one.
    this.history = [];
    this.seenCallIds = new Set();
  }

  async *run(userMessage: string, runOptions: RunOptions = {}): AsyncGenerator<AgentEvent> {
    const { provider, registry, storage } = this.options;
    const now = this.options.now ?? (() => new Date());
    const requested = this.options.maxSteps ?? DEFAULT_MAX_STEPS;
    const maxSteps = Number.isFinite(requested)
      ? Math.max(0, Math.floor(requested))
      : DEFAULT_MAX_STEPS;
    const signal = runOptions.signal ?? new AbortController().signal;
    const history = this.history;
    const seen = this.seenCallIds;
    const runId = `run-${++this.runCount}`;
    const aborted = function* (): Generator<AgentEvent> {
      yield { type: "error", code: "Aborted", message: "Run cancelled" };
      yield { type: "run_finished", reason: "aborted" };
    };

    yield { type: "run_started", runId, prompt: userMessage };
    history.push({ role: "user", content: userMessage });

    let steps = 0;
    let turn = 0;
    for (;;) {
      if (signal.aborted) {
        yield* aborted();
        return;
      }

      yield { type: "step_started", step: ++turn };
      let reply;
      const t0 = now().getTime();
      let thoughtUntil: number | null = null;
      let thought = "";
      try {
        const stream = withDeltas((onDelta) =>
          provider.complete({
            messages: history,
            tools: registry.toJsonSchema(),
            system: this.options.system,
            signal,
            onDelta,
          }),
        );
        for (let next = await stream.next(); ; next = await stream.next()) {
          if (next.done) {
            reply = next.value;
            break;
          }
          const d = next.value;
          if (d.kind === "reasoning") {
            thought += d.text;
            yield { type: "reasoning_delta", text: d.text };
          } else {
            thoughtUntil ??= now().getTime();
            yield { type: "message_delta", text: d.text };
          }
        }
      } catch (err) {
        if (signal.aborted) {
          yield* aborted();
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        yield { type: "error", code: "Provider", message };
        yield { type: "run_finished", reason: "error" };
        return;
      }

      // Providers may omit ids or reuse them across turns. Results and approvals are matched by
      // id, so give any missing or repeated id a fresh one before it enters the history.
      const calls: ToolCall[] = reply.toolCalls.map((c, i) => {
        const id = c.id && !seen.has(c.id) ? c.id : `${runId}-t${turn}-c${i}`;
        seen.add(id);
        return { ...c, id };
      });
      history.push({
        role: "assistant",
        content: reply.text,
        ...(calls.length > 0 ? { toolCalls: calls } : {}),
        ...(reply.reasoning ? { reasoning: reply.reasoning } : {}),
      });
      if (thought !== "")
        yield {
          type: "reasoning",
          text: thought,
          durationMs: Math.max(0, (thoughtUntil ?? now().getTime()) - t0),
        };
      if (reply.text !== "") yield { type: "message", text: reply.text };
      if (calls.length === 0) {
        yield { type: "run_finished", reason: "complete" };
        return;
      }

      let budgetHit = false;
      let stopped = false;
      for (const call of calls) {
        if (stopped || signal.aborted) {
          // Stopped: answer the remaining calls without running them.
          stopped = true;
          this.pushResult(history, call, {
            type: "Aborted",
            message: "Not run: the run was stopped",
          });
          continue;
        }
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
          this.pushResult(history, call, {
            type: "StepBudget",
            message: "Not run: step budget exhausted",
          });
          continue;
        }
        steps++;
        yield* this.runCall(call, runOptions, { registry, storage, now, signal, history });
      }
      if (stopped || signal.aborted) {
        yield* aborted();
        return;
      }
      if (budgetHit) {
        yield { type: "run_finished", reason: "budget" };
        return;
      }
    }
  }

  private pushResult(history: ChatMessage[], call: ToolCall, error: ToolError): void {
    history.push({
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
      history: ChatMessage[];
    },
  ): AsyncGenerator<AgentEvent> {
    const { registry, storage, now, signal, history } = env;
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
      this.pushResult(history, call, error);
      return {
        type: "tool_result",
        callId: call.id,
        name: call.name,
        ok: false,
        error,
        durationMs: Date.now() - started,
      };
    };

    if (signal.aborted) {
      yield fail("Aborted", "Not run: the run was stopped");
      return;
    }

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

    // The consumer can cancel while approval is pending or while handling a yielded event.
    if (signal.aborted) {
      yield fail("Aborted", "Not run: the run was stopped");
      return;
    }

    // 3. Run.
    const { provider } = this.options;
    const result = await registry.execute(validTool, input, {
      storage,
      signal,
      now,
      actor: { providerId: provider.id, isMock: provider.isMock },
    });
    if (!result.ok) {
      yield fail(result.error.type, result.error.message);
      return;
    }
    const output = result.value;
    history.push({
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
