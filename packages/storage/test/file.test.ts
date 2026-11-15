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
      const b = new FileStorage(dir);
      expect(await b.list("things")).toHaveLength(20);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
