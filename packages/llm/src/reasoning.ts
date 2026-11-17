/**
 * Reasoning levels per vendor and model. Vendors name and encode them differently, and many
 * models have none, so the UI asks here what to offer. Sources, checked Nov 16, 2026:
 * - DeepSeek: thinking is on by default; `thinking.type` turns it off, `reasoning_effort` is
 *   low | high | max. https://api-docs.deepseek.com/guides/thinking_mode
 * - Anthropic: `output_config.effort` (low | medium | high) on the models its docs list.
 *   https://platform.claude.com/docs/en/build-with-claude/effort
 * - OpenAI: `reasoning.effort` (Responses API) on its reasoning models (o-series, GPT-5 and
 *   later). Values are model-dependent; low | medium | high is the subset they share.
 *   https://developers.openai.com/api/docs/guides/reasoning
 * - OpenRouter: `reasoning.effort`, offered when its model list says the model takes it.
 * Anything else gets no levels: an unknown parameter would fail the request.
 */
export type ReasoningLevel = "off" | "low" | "medium" | "high" | "max";
export type ReasoningStyle = "deepseek" | "anthropic" | "openai" | "openrouter";

/** One entry of a vendor's model list. */
export interface ModelInfo {
  id: string;
  /** The vendor's list says this model accepts reasoning settings (OpenRouter only). */
  reasoning?: boolean;
}

/** Saved with a provider config. No setting means the model's default. */
export interface ReasoningSetting {
  style: ReasoningStyle;
  level: ReasoningLevel;
}

export interface ReasoningOptions {
  style: ReasoningStyle;
  levels: ReasoningLevel[];
}

const ANTHROPIC_EFFORT =
  /^claude-(?:(?:fable|mythos|opus|sonnet|haiku)-5|opus-4-[5-8]|sonnet-4-6|mythos-preview)/;
const OPENAI_REASONING = /^(?:o\d|gpt-[5-9])/;
/** Chat snapshots such as gpt-5-chat-latest reject `reasoning_effort`. */
const OPENAI_CHAT_SNAPSHOT = /-chat(?:-|$)/;

/** What this model offers, or null when it has no adjustable reasoning. */
export function reasoningOptions(
  preset: string,
  model: string,
  info?: ModelInfo,
): ReasoningOptions | null {
  const m = model.trim().toLowerCase();
  if (m === "") return null;
  switch (preset) {
    case "deepseek":
      return { style: "deepseek", levels: ["off", "low", "high", "max"] };
    case "anthropic":
      return ANTHROPIC_EFFORT.test(m)
        ? { style: "anthropic", levels: ["low", "medium", "high"] }
        : null;
    case "openai":
      return OPENAI_REASONING.test(m) && !OPENAI_CHAT_SNAPSHOT.test(m)
        ? { style: "openai", levels: ["low", "medium", "high"] }
        : null;
    case "openrouter":
      return info?.reasoning ? { style: "openrouter", levels: ["low", "medium", "high"] } : null;
    default:
      return null;
  }
}

/** Extra request fields for a saved setting. Empty when there is nothing to send. */
export function reasoningParams(setting: ReasoningSetting | undefined): Record<string, unknown> {
  if (!setting) return {};
  const { style, level } = setting;
  switch (style) {
    case "deepseek":
      return level === "off"
        ? { thinking: { type: "disabled" } }
        : { thinking: { type: "enabled" }, reasoning_effort: level };
    case "openai":
      return level === "off" ? {} : { reasoning_effort: level };
    case "openrouter":
      return level === "off" ? { reasoning: { enabled: false } } : { reasoning: { effort: level } };
    case "anthropic":
      return level === "off" ? {} : { output_config: { effort: level } };
  }
}

const STYLES: readonly string[] = ["deepseek", "anthropic", "openai", "openrouter"];
const LEVELS: readonly string[] = ["off", "low", "medium", "high", "max"];

export function parseReasoning(raw: unknown): ReasoningSetting | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.style !== "string" || !STYLES.includes(r.style)) return undefined;
  if (typeof r.level !== "string" || !LEVELS.includes(r.level)) return undefined;
  return { style: r.style as ReasoningStyle, level: r.level as ReasoningLevel };
}

export function parseModelList(raw: unknown): ModelInfo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((m: unknown) => {
    const r = (typeof m === "object" && m !== null ? m : {}) as Record<string, unknown>;
    return typeof r.id === "string" && r.id !== ""
      ? [{ id: r.id, ...(r.reasoning === true ? { reasoning: true } : {}) }]
      : [];
  });
}
