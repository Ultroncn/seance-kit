import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExportFile, Storage, StoredItem } from "../src/types";

/**
 * Shared contract suite. Every Storage adapter must pass it unchanged.
 * `create` returns a fresh, empty storage. `dispose` cleans up after each test.
 */
export function runStorageContract(
  name: string,
  create: () => Promise<Storage> | Storage,
  dispose: (s: Storage) => Promise<void> | void = () => {},
  opts: { numRuns?: number } = {},
): void {
  const numRuns = opts.numRuns ?? 40;

  describe(`Storage contract: ${name}`, () => {
    let s: Storage;
    beforeEach(async () => {
      s = await create();
    });
    afterEach(async () => {
      await dispose(s);
    });

    const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
    const readExport = async (): Promise<ExportFile> =>
      JSON.parse(await (await s.exportAll()).text()) as ExportFile;

    it("returns undefined for a missing item", async () => {
      expect(await s.get("things", "nope")).toBeUndefined();
    });

    it("put then get round-trips, and put replaces by id", async () => {
      await s.put("things", { id: "a", n: 1 });
      await s.put("things", { id: "a", n: 2, extra: true });
      expect(await s.get("things", "a")).toEqual({ id: "a", n: 2, extra: true });
    });

    it("keeps collections separate", async () => {
      await s.put("one", { id: "x", v: 1 });
      await s.put("two", { id: "x", v: 2 });
      expect(await s.get("one", "x")).toEqual({ id: "x", v: 1 });
      expect(await s.get("two", "x")).toEqual({ id: "x", v: 2 });
      expect(await s.list("one")).toHaveLength(1);
    });

    it("lists sorted by id and supports offset and limit", async () => {
      for (const id of ["b", "c", "a", "B", "aa"]) await s.put("things", { id });
      const ids = (await s.list("things")).map((i) => i.id);
      expect(ids).toEqual(["B", "a", "aa", "b", "c"]);
      expect((await s.list("things", { offset: 1, limit: 2 })).map((i) => i.id)).toEqual([
        "a",
        "aa",
      ]);
      expect(await s.list("things", { offset: 10 })).toEqual([]);
      expect(await s.list("things", { limit: 0 })).toEqual([]);
    });

    it("lists an unknown collection as empty", async () => {
      expect(await s.list("never_used")).toEqual([]);
    });

    it("remove deletes, and removing a missing id is a no-op", async () => {
      await s.put("things", { id: "a" });
      await s.remove("things", "a");
      await s.remove("things", "a");
      await s.remove("never_used", "a");
      expect(await s.get("things", "a")).toBeUndefined();
    });

    it("isolates stored data from caller mutation", async () => {
      const item = { id: "a", nested: { n: 1 }, arr: [1] };
      await s.put("things", item);
      item.nested.n = 99;
      item.arr.push(2);
      const got = (await s.get<StoredItem>("things", "a"))!;
      expect(got).toEqual({ id: "a", nested: { n: 1 }, arr: [1] });
      (got.nested as { n: number }).n = 7;
      expect(await s.get("things", "a")).toEqual({ id: "a", nested: { n: 1 }, arr: [1] });
    });

    it("rejects invalid collection names and ids", async () => {
      for (const bad of ["", "../x", "a/b", "1abc", "a b", "a.json"]) {
        await expect(s.put(bad, { id: "a" })).rejects.toThrow(TypeError);
        await expect(s.list(bad)).rejects.toThrow(TypeError);
      }
      await expect(s.put("things", { id: "" })).rejects.toThrow(TypeError);
      await expect(s.get("things", "")).rejects.toThrow(TypeError);
    });

    it("handles collection names that are also object built-ins", async () => {
      for (const name of ["constructor", "toString", "hasOwnProperty"])
        await s.put(name, { id: "x" });
      const file = JSON.parse(await (await s.exportAll()).text());
      expect(Object.keys(file.collections).sort()).toEqual([
        "constructor",
        "hasOwnProperty",
        "toString",
      ]);
    });

    it("exportAll never includes secrets, and wipe removes them", async () => {
      await s.put("secrets", { id: "provider", apiKey: "sk-should-not-leak" });
      await s.put("notes", { id: "n1" });
      const text = await (await s.exportAll()).text();
      expect(text).not.toContain("sk-should-not-leak");
      expect(JSON.parse(text).collections).toEqual({ notes: [{ id: "n1" }] });
      await s.wipe();
      expect(await s.get("secrets", "provider")).toBeUndefined();
    });

    it("exportAll lists every non-empty collection, and wipe empties everything", async () => {
      await s.put("one", { id: "b", v: 1 });
      await s.put("one", { id: "a", v: 2 });
      await s.put("two", { id: "x" });
      await s.put("empty", { id: "gone" });
      await s.remove("empty", "gone");
      expect(await readExport()).toEqual({
        version: 1,
        collections: {
          one: [
            { id: "a", v: 2 },
            { id: "b", v: 1 },
          ],
          two: [{ id: "x" }],
        },
      });
      await s.wipe();
      expect(await s.list("one")).toEqual([]);
      expect(await s.list("two")).toEqual([]);
      expect((await readExport()).collections).toEqual({});
    });

    it("P5 put(x) then get(x.id) equals the JSON form of x, for any JSON item", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.dictionary(
            fc.string().filter((k) => k !== "id"),
            fc.jsonValue(),
          ),
          async (id, rest) => {
            await s.wipe();
            const item = { ...rest, id };
            await s.put("things", item);
            expect(await s.get("things", id)).toEqual(json(item));
          },
        ),
        { numRuns },
      );
    });

    it("P5 after any sequence of put/remove, list matches a model and wipe empties it", async () => {
      const op = fc.oneof(
        fc.record({
          kind: fc.constant("put" as const),
          c: fc.constantFrom("alpha", "beta"),
          id: fc.constantFrom("a", "b", "c", "d", "é", "z"),
          v: fc.integer(),
        }),
        fc.record({
          kind: fc.constant("remove" as const),
          c: fc.constantFrom("alpha", "beta"),
          id: fc.constantFrom("a", "b", "c", "d", "é", "z"),
        }),
      );
      await fc.assert(
        fc.asyncProperty(fc.array(op, { maxLength: 25 }), async (ops) => {
          await s.wipe();
          const model: Record<string, Map<string, unknown>> = { alpha: new Map(), beta: new Map() };
          for (const o of ops) {
            if (o.kind === "put") {
              await s.put(o.c, { id: o.id, v: o.v });
              model[o.c]!.set(o.id, { id: o.id, v: o.v });
            } else {
              await s.remove(o.c, o.id);
              model[o.c]!.delete(o.id);
            }
          }
          for (const c of ["alpha", "beta"]) {
            const expected = [...model[c]!.values()].sort((a, b) =>
              (a as StoredItem).id < (b as StoredItem).id ? -1 : 1,
            );
            expect(await s.list(c)).toEqual(expected);
          }
          await s.wipe();
          expect(await s.list("alpha")).toEqual([]);
          expect(await s.list("beta")).toEqual([]);
        }),
        { numRuns },
      );
    });
  });
}
