import type { ChatMessage, CompleteRequest, Provider, ProviderReply, ToolCall } from "./types";

/** What the mock says in one model turn. Tool calls run before the next step is requested. */
export interface MockReply {
  text?: string;
  toolCalls?: { name: string; input: unknown }[];
}

/** Context handed to a dynamic step, so a script can use earlier tool results. */
export interface MockStepContext {
  userText: string;
  /** Tool messages produced since the user's last message, oldest first. */
  toolResults: Extract<ChatMessage, { role: "tool" }>[];
}

export type MockStep = MockReply | ((ctx: MockStepContext) => MockReply);

export interface MockScript {
  /**
   * Matched against the latest user message. Strings match case-insensitively as substrings.
   * A list matches if any entry does, for example the same prompt in two languages.
   */
  match: string | readonly string[] | RegExp;
  /** One entry per model turn. After the last step the mock replies with `finalText`. */
  steps: MockStep[];
  finalText?: string;
}

export interface MockProviderOptions {
  scripts: MockScript[];
  /** Reply for prompts no script matches. A function is read on every reply, so it can follow the UI language. */
  unknownPromptText?: string | (() => string);
}

const DEFAULT_UNKNOWN =
  "Demo mode only understands a few scripted prompts. Pick one of the suggestions, or switch to a real provider in Settings.";

function matches(match: MockScript["match"], text: string): boolean {
  if (typeof match === "string") return text.toLowerCase().includes(match.toLowerCase());
  if (match instanceof RegExp) return match.test(text);
  return match.some((m) => matches(m, text));
}

/**
 * Deterministic provider that replays scripted tool-call traces. Same input, same output.
 * Never calls a network. Always `isMock: true`, so the UI shows the "Demo mode" badge.
 */
export class MockProvider implements Provider {
  readonly id = "mock";
  readonly isMock = true;

  constructor(private readonly options: MockProviderOptions) {}

  /** Prompts the mock understands. The UI can offer these as suggestion chips. */
  get suggestions(): string[] {
    return this.options.scripts.flatMap((s) =>
      typeof s.match === "string" ? [s.match] : Array.isArray(s.match) ? s.match.slice(0, 1) : [],
    );
  }

  private unknown(): string {
    const t = this.options.unknownPromptText;
    return (typeof t === "function" ? t() : t) ?? DEFAULT_UNKNOWN;
  }

  async complete(request: CompleteRequest): Promise<ProviderReply> {
    const { messages } = request;
    const lastUser = findLastIndex(messages, (m) => m.role === "user");
    if (lastUser < 0) return { text: this.unknown(), toolCalls: [] };

    const userText = (messages[lastUser] as { content: string }).content;
    const script = this.options.scripts.find((s) => matches(s.match, userText));
    if (!script) return { text: this.unknown(), toolCalls: [] };

    const turn = messages.slice(lastUser + 1);
    const stepIndex = turn.filter((m) => m.role === "assistant").length;
    const step = script.steps[stepIndex];
    if (step === undefined) return { text: script.finalText ?? "Done.", toolCalls: [] };

    const toolResults = turn.filter(
      (m): m is Extract<ChatMessage, { role: "tool" }> => m.role === "tool",
    );
    const reply = typeof step === "function" ? step({ userText, toolResults }) : step;
    const toolCalls: ToolCall[] = (reply.toolCalls ?? []).map((c, i) => ({
      id: `mock-${lastUser}-${stepIndex}-${i}`,
      name: c.name,
      input: c.input,
    }));
    return { text: reply.text ?? "", toolCalls };
  }
}

function findLastIndex<T>(items: T[], pred: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (pred(items[i] as T)) return i;
  return -1;
}
