import { AnthropicProvider } from "./anthropic";
import type { FetchLike } from "./http";
import { OpenAiCompatibleProvider, createOllamaProvider } from "./openai";
import { OpenAiResponsesProvider, isOpenAiPlatform } from "./openai-responses";
import { reasoningParams, type ReasoningSetting } from "./reasoning";
import type { Provider } from "./types";

/** Saved in settings. Contains secrets, so it only ever lives in the browser's IndexedDB. */
export type ProviderConfig =
  /** `baseUrl` points at another Anthropic-compatible server, for example DeepSeek's. */
  | {
      kind: "anthropic";
      apiKey: string;
      model: string;
      baseUrl?: string;
      reasoning?: ReasoningSetting;
    }
  /** `apiKey` may be empty for local servers such as LM Studio. */
  | {
      kind: "openai-compatible";
      baseUrl: string;
      apiKey: string;
      model: string;
      reasoning?: ReasoningSetting;
    }
  | { kind: "ollama"; model: string; host?: string };

export type ProviderKind = ProviderConfig["kind"];

/** Build a real provider from saved settings. Throws a readable error for incomplete settings. */
export function createProvider(config: ProviderConfig, fetchImpl?: FetchLike): Provider {
  switch (config.kind) {
    case "anthropic":
      requireFields(config, ["apiKey", "model"]);
      return new AnthropicProvider({
        apiKey: config.apiKey,
        model: config.model,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        extraBody: reasoningParams(config.reasoning),
        fetch: fetchImpl,
      });
    case "openai-compatible":
      requireFields(config, ["baseUrl", "model"]);
      if (isOpenAiPlatform(config.baseUrl)) {
        requireFields(config, ["apiKey"]);
        const r = config.reasoning;
        return new OpenAiResponsesProvider({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          ...(r?.style === "openai" && r.level !== "off" ? { reasoningEffort: r.level } : {}),
          fetch: fetchImpl,
        });
      }
      return new OpenAiCompatibleProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        extraBody: reasoningParams(config.reasoning),
        fetch: fetchImpl,
      });
    case "ollama":
      requireFields(config, ["model"]);
      return createOllamaProvider({ model: config.model, host: config.host, fetch: fetchImpl });
  }
}

function requireFields<T extends object>(config: T, fields: (keyof T & string)[]): void {
  for (const f of fields) {
    const v = config[f];
    if (typeof v !== "string" || v.trim() === "") throw new Error(`Missing setting: ${f}`);
  }
}
