import type { StreamDelta } from "@seance/llm";

/**
 * Run `call`, yielding each delta it reports while it runs, then return its result. Lets an
 * async generator pass on callback-style streaming without losing order or a final error.
 */
export async function* withDeltas<T>(
  call: (onDelta: (d: StreamDelta) => void) => Promise<T>,
): AsyncGenerator<StreamDelta, T> {
  const queue: StreamDelta[] = [];
  let wake: (() => void) | null = null;
  let settled = false;
  const promise = call((d) => {
    queue.push(d);
    wake?.();
  }).finally(() => {
    settled = true;
    wake?.();
  });
  // Keep a rejection from surfacing as "unhandled" while deltas are still being drained.
  promise.catch(() => undefined);
  for (;;) {
    while (queue.length > 0) yield queue.shift() as StreamDelta;
    if (settled) return await promise;
    await new Promise<void>((r) => (wake = r));
    wake = null;
  }
}
