import { AnthropicProvider } from "./anthropic";
import type { FetchLike } from "./http";
import { OpenAiCompatibleProvider, createOllamaProvider } from "./openai";
import type { Provider } from "./types";

/** Saved in settings. Contains secrets, so it only ever lives in the browser's IndexedDB. */
export type ProviderConfig =
  | { kind: "anthropic"; apiKey: string; model: string }
  | { kind: "openai-compatible"; baseUrl: string; apiKey: string; model: string }
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
        fetch: fetchImpl,
      });
    case "openai-compatible":
      requireFields(config, ["baseUrl", "apiKey", "model"]);
      return new OpenAiCompatibleProvider({ ...config, fetch: fetchImpl });
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
