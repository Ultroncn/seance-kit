import {
  clearProviderConfig,
  createProvider,
  loadProviderConfig,
  saveProviderConfig,
  type Provider,
  type ProviderConfig,
} from "@seance/llm";
import type { Storage } from "@seance/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ProviderModeValue {
  /** The provider the agent must use. Always take it from here, so the badge and the agent agree. */
  provider: Provider;
  /** Read from `provider` itself, never stored separately. Drives the Demo-mode badge. */
  isMock: boolean;
  /** Saved real-provider settings, or null in demo mode. */
  config: ProviderConfig | null;
  /** False until saved settings have been read. The mock is used until then. */
  ready: boolean;
  /** Why saved settings could not be used, if they could not. */
  error: string | null;
  /** Save a real provider, or pass null to forget the key and return to demo mode. */
  save: (config: ProviderConfig | null) => Promise<void>;
  /** Re-read settings, for example after wiping all data. */
  reload: () => Promise<void>;
  /** Build a provider from settings without saving them. Used by "Test connection". */
  build: (config: ProviderConfig) => Provider;
  storage: Storage;
}

const Ctx = createContext<ProviderModeValue | null>(null);

export interface ProviderModeProviderProps {
  storage: Storage;
  /** The app's scripted demo provider. */
  mock: Provider;
  /** Override for tests. Defaults to `createProvider` from `@seance/llm`. */
  createReal?: (config: ProviderConfig) => Provider;
  children: ReactNode;
}

export function ProviderModeProvider({
  storage,
  mock,
  createReal = createProvider,
  children,
}: ProviderModeProviderProps) {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setConfig(await loadProviderConfig(storage));
    setReady(true);
  }, [storage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (next: ProviderConfig | null) => {
      if (next) await saveProviderConfig(storage, next);
      else await clearProviderConfig(storage);
      setConfig(next);
    },
    [storage],
  );

  const value = useMemo<ProviderModeValue>(() => {
    let provider = mock;
    let error: string | null = null;
    if (config) {
      try {
        provider = createReal(config);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
    return {
      provider,
      isMock: provider.isMock,
      config,
      ready,
      error,
      save,
      reload,
      build: createReal,
      storage,
    };
  }, [mock, config, ready, save, reload, createReal, storage]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProviderMode(): ProviderModeValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useProviderMode needs a <ProviderModeProvider> above it");
  return value;
}
