import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileStorage } from "../src/file";
import { runStorageContract } from "./contract";

const dirs = new Map<unknown, string>();

runStorageContract(
  "FileStorage",
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "seance-file-"));
    const s = new FileStorage(join(dir, "data"));
    dirs.set(s, dir);
    return s;
  },
  async (s) => {
    await (s as FileStorage).flush();
    await rm(dirs.get(s)!, { recursive: true, force: true });
  },
  { numRuns: 15 },
);

describe("FileStorage specifics", () => {
  it("persists across instances and survives concurrent writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "seance-file-"));
    try {
      const a = new FileStorage(dir);
      await Promise.all(Array.from({ length: 20 }, (_, i) => a.put("things", { id: `id${i}`, i })));
      await a.flush();
      const b = new FileStorage(dir);
      expect(await b.list("things")).toHaveLength(20);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes many changes in one save, and nothing reaches disk before flush", async () => {
    const dir = await mkdtemp(join(tmpdir(), "seance-file-"));
    try {
      const a = new FileStorage(dir, { flushDelayMs: 60_000 });
      for (let i = 0; i < 50; i++) await a.put("things", { id: `t${i}` });
      expect(await new FileStorage(dir).list("things")).toEqual([]);
      await a.flush();
      expect(await new FileStorage(dir).list("things")).toHaveLength(50);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stays linear: 2,000 puts and 200 gets take well under a second", async () => {
    const dir = await mkdtemp(join(tmpdir(), "seance-file-"));
    try {
      const s = new FileStorage(dir);
      const t = performance.now();
      for (let i = 0; i < 2000; i++) await s.put("emails", { id: `e${i}`, text: "x".repeat(2000) });
      for (let i = 0; i < 2000; i += 10) await s.get("emails", `e${i}`);
      await s.flush();
      expect(performance.now() - t).toBeLessThan(1500);
      expect(await new FileStorage(dir).list("emails")).toHaveLength(2000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

it("keeps the captured id when the caller mutates an item before the queued write", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seance-file-"));
  const storage = new FileStorage(dir, { flushDelayMs: 60_000 });
  try {
    await storage.put("things", { id: "b", value: "keep" });
    const item = { id: "a", value: "new" };
    const pending = storage.put("things", item);
    item.id = "b";
    await pending;
    expect(await storage.get("things", "a")).toEqual({ id: "a", value: "new" });
    expect(await storage.get("things", "b")).toEqual({ id: "b", value: "keep" });
    await storage.flush();
    expect(await new FileStorage(dir).list("things")).toEqual([
      { id: "a", value: "new" },
      { id: "b", value: "keep" },
    ]);
  } finally {
    await storage.flush();
    await rm(dir, { recursive: true, force: true });
  }
});
