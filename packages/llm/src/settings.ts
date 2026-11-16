import { SECRETS_COLLECTION, type Storage } from "@seance/storage";
import type { ProviderConfig } from "./factory";
import { parseModelList, parseReasoning, type ModelInfo } from "./reasoning";

/** Record id of the single provider config saved by earlier versions. Read once, then migrated. */
export const PROVIDER_SETTINGS_ID = "provider";
/** Record id of the saved provider profiles inside the `secrets` collection. */
export const PROVIDER_PROFILES_ID = "providers";

const str = (v: unknown): v is string => typeof v === "string";

/** Accept only well-formed configs. Anything else reads as "no real provider", i.e. demo mode. */
export function parseProviderConfig(raw: unknown): ProviderConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "anthropic":
      return str(r.apiKey) && str(r.model) && (r.baseUrl === undefined || str(r.baseUrl))
        ? {
            kind: "anthropic",
            apiKey: r.apiKey,
            model: r.model,
            ...(str(r.baseUrl) ? { baseUrl: r.baseUrl } : {}),
            ...withReasoning(r.reasoning),
          }
        : null;
    case "openai-compatible":
      return str(r.baseUrl) && str(r.apiKey) && str(r.model)
        ? {
            kind: "openai-compatible",
            baseUrl: r.baseUrl,
            apiKey: r.apiKey,
            model: r.model,
            ...withReasoning(r.reasoning),
          }
        : null;
    case "ollama":
      return str(r.model) && (r.host === undefined || str(r.host))
        ? { kind: "ollama", model: r.model, ...(str(r.host) ? { host: r.host } : {}) }
        : null;
    default:
      return null;
  }
}

const withReasoning = (raw: unknown) => {
  const reasoning = parseReasoning(raw);
  return reasoning ? { reasoning } : {};
};

/** One saved provider, like a CC Switch entry: a name, the vendor preset it came from, settings. */
export interface ProviderProfile {
  id: string;
  name: string;
  /** Preset id from `PROVIDER_PRESETS`, or a custom one. Only used to prefill the form. */
  preset: string;
  config: ProviderConfig;
  /** The vendor's model list, as last loaded. Empty until loaded. */
  models?: ModelInfo[];
}

export interface ProviderProfiles {
  /** The profile the agent uses, or null for demo mode. */
  activeId: string | null;
  profiles: ProviderProfile[];
}

export const EMPTY_PROFILES: ProviderProfiles = { activeId: null, profiles: [] };

function parseProfile(raw: unknown): ProviderProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const config = parseProviderConfig(r.config);
  const models = parseModelList(r.models);
  return str(r.id) && r.id !== "" && str(r.name) && str(r.preset) && config
    ? { id: r.id, name: r.name, preset: r.preset, config, ...(models ? { models } : {}) }
    : null;
}

/** Damaged entries are dropped. An active id that points nowhere means demo mode. */
export function parseProviderProfiles(raw: unknown): ProviderProfiles {
  if (typeof raw !== "object" || raw === null) return EMPTY_PROFILES;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const profiles = (Array.isArray(r.profiles) ? r.profiles : [])
    .map(parseProfile)
    .filter((p): p is ProviderProfile => p !== null && !seen.has(p.id) && !!seen.add(p.id));
  const activeId = str(r.activeId) && seen.has(r.activeId) ? r.activeId : null;
  return { activeId, profiles };
}

const legacyPreset = (c: ProviderConfig) =>
  c.kind === "anthropic" ? "anthropic" : c.kind === "ollama" ? "ollama" : "custom-openai";

/**
 * Saved profiles. They live in the `secrets` collection, which `exportAll` never writes, so API
 * keys stay in this browser's IndexedDB. A single config saved by an earlier version becomes the
 * first, active profile.
 */
export async function loadProviderProfiles(storage: Storage): Promise<ProviderProfiles> {
  const record = await storage.get(SECRETS_COLLECTION, PROVIDER_PROFILES_ID);
  if (record) return parseProviderProfiles(record);
  const legacy = await storage.get(SECRETS_COLLECTION, PROVIDER_SETTINGS_ID);
  if (!legacy) return EMPTY_PROFILES;
  const { id: _id, ...rest } = legacy;
  const config = parseProviderConfig(rest);
  if (!config) return EMPTY_PROFILES;
  return {
    activeId: "migrated",
    profiles: [
      { id: "migrated", name: legacyPreset(config), preset: legacyPreset(config), config },
    ],
  };
}

export async function saveProviderProfiles(
  storage: Storage,
  value: ProviderProfiles,
): Promise<void> {
  const clean = parseProviderProfiles(value);
  if (clean.profiles.length !== value.profiles.length)
    throw new Error("Incomplete provider settings");
  await storage.put(SECRETS_COLLECTION, { id: PROVIDER_PROFILES_ID, ...clean });
  await storage.remove(SECRETS_COLLECTION, PROVIDER_SETTINGS_ID);
}

/** The settings the agent uses now, or null for demo mode. */
export async function loadProviderConfig(storage: Storage): Promise<ProviderConfig | null> {
  const { activeId, profiles } = await loadProviderProfiles(storage);
  return profiles.find((p) => p.id === activeId)?.config ?? null;
}
