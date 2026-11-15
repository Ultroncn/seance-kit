import { SECRETS_COLLECTION, type Storage } from "@seance/storage";
import type { ProviderConfig } from "./factory";

/** Record id of the saved provider config inside the `secrets` collection. */
export const PROVIDER_SETTINGS_ID = "provider";

const str = (v: unknown): v is string => typeof v === "string";

/** Accept only well-formed configs. Anything else reads as "no real provider", i.e. demo mode. */
export function parseProviderConfig(raw: unknown): ProviderConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "anthropic":
      return str(r.apiKey) && str(r.model)
        ? { kind: "anthropic", apiKey: r.apiKey, model: r.model }
        : null;
    case "openai-compatible":
      return str(r.baseUrl) && str(r.apiKey) && str(r.model)
        ? { kind: "openai-compatible", baseUrl: r.baseUrl, apiKey: r.apiKey, model: r.model }
        : null;
    case "ollama":
      return str(r.model) && (r.host === undefined || str(r.host))
        ? { kind: "ollama", model: r.model, ...(str(r.host) ? { host: r.host } : {}) }
        : null;
    default:
      return null;
  }
}

/**
 * The saved provider config, or null for demo mode. It lives in the `secrets` collection, which
 * `exportAll` never writes, so the API key stays in this browser's IndexedDB.
 */
export async function loadProviderConfig(storage: Storage): Promise<ProviderConfig | null> {
  const record = await storage.get(SECRETS_COLLECTION, PROVIDER_SETTINGS_ID);
  if (!record) return null;
  const { id: _id, ...rest } = record;
  return parseProviderConfig(rest);
}

export async function saveProviderConfig(storage: Storage, config: ProviderConfig): Promise<void> {
  const parsed = parseProviderConfig(config);
  if (!parsed) throw new Error("Incomplete provider settings");
  await storage.put(SECRETS_COLLECTION, { id: PROVIDER_SETTINGS_ID, ...parsed });
}

/** Forget the key and return to demo mode. */
export async function clearProviderConfig(storage: Storage): Promise<void> {
  await storage.remove(SECRETS_COLLECTION, PROVIDER_SETTINGS_ID);
}
