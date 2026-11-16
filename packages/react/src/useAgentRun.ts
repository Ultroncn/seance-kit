import {
  createAgent,
  reduceTimeline,
  undoBanish,
  type Agent,
  type ApprovalRequest,
  type Risk,
  type TimelineEntry,
  type ToolRegistry,
} from "@seance/core";
import type { Provider } from "@seance/llm";
import type { Storage } from "@seance/storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseAgentRunOptions {
  /** Take it from `useProviderMode()`, so the agent and the Demo badge agree. */
  provider: Provider;
  registry: ToolRegistry;
  storage: Storage;
  system?: string;
  maxSteps?: number;
  /** Called after a tool changed data (risk write or destructive) and after an undo. */
  onDataChange?: () => void;
}

export interface AgentRunState {
  entries: TimelineEntry[];
  busy: boolean;
  /** Undo tokens already used. Pass to `<SeanceTimeline undone>`. */
  undone: ReadonlySet<string>;
  run: (prompt: string) => Promise<void>;
  approve: (callId: string) => void;
  reject: (callId: string) => void;
  undo: (undoToken: string) => Promise<void>;
  /** Stop the run. Pending approvals count as rejected. */
  stop: () => void;
  /** Start a fresh conversation with the agent. */
  reset: () => void;
}

/**
 * Runs the core agent loop for a React UI: folds events into the séance timeline, turns approval
 * requests into Allow/Reject buttons, and supports undo of destructive steps.
 */
export function useAgentRun({
  provider,
  registry,
  storage,
  system,
  maxSteps,
  onDataChange,
}: UseAgentRunOptions): AgentRunState {
  const agent = useMemo<Agent>(
    () => createAgent({ provider, registry, storage, system, maxSteps }),
    [provider, registry, storage, system, maxSteps],
  );
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(new Map<string, (ok: boolean) => void>());
  const abort = useRef<AbortController | null>(null);
  // Bumped by reset(). Events from an older run never reach the new timeline.
  const generation = useRef(0);
  const onChange = useRef(onDataChange);
  onChange.current = onDataChange;

  const settleAll = () => {
    for (const resolve of pending.current.values()) resolve(false);
    pending.current.clear();
  };

  // A new provider or registry means a new agent: start a clean timeline.
  useEffect(() => {
    setEntries([]);
    setUndone(new Set());
    return () => {
      abort.current?.abort();
      settleAll();
    };
  }, [agent]);

  const run = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (text === "" || abort.current) return;
      const controller = new AbortController();
      abort.current = controller;
      const mine = ++generation.current;
      setBusy(true);
      const risks = new Map<string, Risk | null>();
      try {
        const events = agent.run(text, {
          signal: controller.signal,
          approve: (req: ApprovalRequest) =>
            new Promise<boolean>((resolve) => {
              if (controller.signal.aborted) return resolve(false);
              pending.current.set(req.callId, resolve);
            }),
        });
        for await (const event of events) {
          if (generation.current !== mine) continue;
          setEntries((all) => reduceTimeline(all, event));
          if (event.type === "tool_called") risks.set(event.callId, event.risk);
          if (event.type === "tool_result" && event.ok && risks.get(event.callId) !== "read")
            onChange.current?.();
        }
      } finally {
        if (generation.current === mine || abort.current === controller) {
          abort.current = null;
          setBusy(false);
        }
        settleAll();
      }
    },
    [agent],
  );

  const decide = (callId: string, ok: boolean) => {
    const resolve = pending.current.get(callId);
    pending.current.delete(callId);
    resolve?.(ok);
  };

  const undo = useCallback(
    async (token: string) => {
      await undoBanish(storage, token);
      setUndone((s) => new Set([...s, token]));
      onChange.current?.();
    },
    [storage],
  );

  return {
    entries,
    busy,
    undone,
    run,
    approve: useCallback((id: string) => decide(id, true), []),
    reject: useCallback((id: string) => decide(id, false), []),
    undo,
    stop: useCallback(() => {
      abort.current?.abort();
      settleAll();
    }, []),
    reset: useCallback(() => {
      generation.current++;
      abort.current?.abort();
      abort.current = null;
      setBusy(false);
      settleAll();
      agent.reset();
      setEntries([]);
      setUndone(new Set());
    }, [agent]),
  };
}
