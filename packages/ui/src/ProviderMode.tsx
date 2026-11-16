import {
  EMPTY_PROFILES,
  createProvider,
  loadProviderProfiles,
  saveProviderProfiles,
  type Provider,
  type ProviderConfig,
  type ProviderProfile,
  type ProviderProfiles,
} from "@seance/llm";
import type { Storage } from "@seance/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ProviderModeValue {
  /** The provider the agent must use. Always take it from here, so the badge and the agent agree. */
  provider: Provider;
  /** Read from `provider` itself, never stored separately. Drives the Demo-mode badge. */
  isMock: boolean;
  /** Settings of the active profile, or null in demo mode. */
  config: ProviderConfig | null;
  /** Every saved provider, like the entries of CC Switch. */
  profiles: ProviderProfile[];
  /** The profile in use, or null for demo mode. */
  activeId: string | null;
  /** False until saved settings have been read. The mock is used until then. */
  ready: boolean;
  /** Why the active profile could not be used, if it could not. */
  error: string | null;
  /** Add or replace a profile. `activate` also switches the agent to it. */
  saveProfile: (profile: ProviderProfile, activate?: boolean) => Promise<void>;
  /** Forget a profile and its key. Removing the active one returns to demo mode. */
  removeProfile: (id: string) => Promise<void>;
  /** Switch the agent to a saved profile, or to demo mode with null. */
  activate: (id: string | null) => Promise<void>;
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
  const [state, setState] = useState<ProviderProfiles>(EMPTY_PROFILES);
  const [ready, setReady] = useState(false);
  // Writes go through one queue, so two quick switches can never save out of order.
  const latest = useRef(state);
  const queue = useRef(Promise.resolve());

  const reload = useCallback(async () => {
    const next = await loadProviderProfiles(storage);
    latest.current = next;
    setState(next);
    setReady(true);
  }, [storage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const commit = useCallback(
    (change: (current: ProviderProfiles) => ProviderProfiles) => {
      const run = queue.current.then(async () => {
        const next = change(latest.current);
        await saveProviderProfiles(storage, next);
        latest.current = next;
        setState(next);
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [storage],
  );

  const saveProfile = useCallback(
    (profile: ProviderProfile, activate = false) =>
      commit((cur) => {
        const exists = cur.profiles.some((p) => p.id === profile.id);
        return {
          activeId: activate ? profile.id : cur.activeId,
          profiles: exists
            ? cur.profiles.map((p) => (p.id === profile.id ? profile : p))
            : [...cur.profiles, profile],
        };
      }),
    [commit],
  );
  const removeProfile = useCallback(
    (id: string) =>
      commit((cur) => ({
        activeId: cur.activeId === id ? null : cur.activeId,
        profiles: cur.profiles.filter((p) => p.id !== id),
      })),
    [commit],
  );
  const activate = useCallback(
    (id: string | null) =>
      commit((cur) => ({
        ...cur,
        activeId: id !== null && cur.profiles.some((p) => p.id === id) ? id : null,
      })),
    [commit],
  );

  const value = useMemo<ProviderModeValue>(() => {
    const config = state.profiles.find((p) => p.id === state.activeId)?.config ?? null;
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
      profiles: state.profiles,
      activeId: config ? state.activeId : null,
      ready,
      error,
      saveProfile,
      removeProfile,
      activate,
      reload,
      build: createReal,
      storage,
    };
  }, [mock, state, ready, saveProfile, removeProfile, activate, reload, createReal, storage]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProviderMode(): ProviderModeValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useProviderMode needs a <ProviderModeProvider> above it");
  return value;
}
