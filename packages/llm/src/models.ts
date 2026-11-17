import type { ProviderConfig } from "./factory";
import { ensureOk, type FetchLike } from "./http";
import { isOpenAiPlatform } from "./openai-responses";
import type { ModelInfo } from "./reasoning";

const trim = (url: string) => url.replace(/\/+$/, "");

/** OpenAI's list also holds audio, image, embedding and moderation models, which cannot chat. */
const OPENAI_NOT_TEXT =
  /(?:embedding|whisper|tts|transcribe|dall-e|image|realtime|audio|moderation|davinci|babbage|sora)/;

export const isOpenAiTextModel = (id: string) => !OPENAI_NOT_TEXT.test(id.toLowerCase());

/**
 * Model ids the vendor offers to this key, sorted. Vendors rename models often, so the settings
 * form asks the vendor instead of shipping a list that goes stale. Throws a readable error.
 */
export async function listModels(
  config: ProviderConfig,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  let url: string;
  let headers: Record<string, string>;
  switch (config.kind) {
    case "anthropic":
      url = `${trim(config.baseUrl ?? "https://api.anthropic.com")}/v1/models?limit=1000`;
      headers = {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      };
      break;
    case "openai-compatible":
      url = `${trim(config.baseUrl)}/models`;
      headers = config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {};
      break;
    case "ollama":
      url = `${trim(config.host ?? "http://localhost:11434")}/v1/models`;
      headers = {};
      break;
  }
  const res = await fetchImpl(url, { method: "GET", headers, ...(signal ? { signal } : {}) });
  await ensureOk(res, "Model list");
  const body = (await res.json()) as { data?: { id?: unknown; supported_parameters?: unknown }[] };
  // OpenRouter also lists each model's parameters, which says whether it takes reasoning settings.
  const byId = new Map<string, ModelInfo>();
  for (const m of body.data ?? []) {
    if (typeof m.id !== "string" || m.id === "" || byId.has(m.id)) continue;
    const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
    byId.set(m.id, { id: m.id, ...(params.includes("reasoning") ? { reasoning: true } : {}) });
  }
  if (config.kind === "openai-compatible" && isOpenAiPlatform(config.baseUrl))
    for (const id of byId.keys()) if (!isOpenAiTextModel(id)) byId.delete(id);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
