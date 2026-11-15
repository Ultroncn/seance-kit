import fc from "fast-check";
import { MemoryStorage, type StoredItem } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { SearchService, banishItems, undoBanish } from "../src/index";

const NOW = new Date("2026-11-16T12:00:00Z");

function makeService(storage: MemoryStorage, name = "docs") {
  return new SearchService({
    storage,
    name,
    collection: "docs",
    fields: ["title", "text"],
    persistDebounceMs: 0,
  });
}

describe("SearchService", () => {
  it("finds items by word and by prefix, across fields", async () => {
    const s = new MemoryStorage();
    await s.put("docs", {
      id: "1",
      title: "Gardening notes",
      text: "tomatoes and basil",
      updatedAt: "1",
    });
    await s.put("docs", { id: "2", title: "Taxes", text: "receipts for 2025", updatedAt: "1" });
    const svc = makeService(s);
    await svc.load();
    expect((await svc.search("basil")).map((h) => h.id)).toEqual(["1"]);
    expect((await svc.search("garden")).map((h) => h.id)).toEqual(["1"]);
    expect((await svc.search("receipts taxes")).map((h) => h.id)).toEqual(["2"]);
    expect(await svc.search("   ")).toEqual([]);
    expect(await svc.search("zzzz")).toEqual([]);
  });

  it("reflects index() and unindex() changes", async () => {
    const s = new MemoryStorage();
    const svc = makeService(s);
    await svc.load();
    const item = { id: "1", title: "first", text: "alpha", updatedAt: "1" };
    await s.put("docs", item);
    svc.index(item);
    expect((await svc.search("alpha")).map((h) => h.id)).toEqual(["1"]);

    const edited = { ...item, text: "omega", updatedAt: "2" };
    await s.put("docs", edited);
    svc.index(edited);
    expect(await svc.search("alpha", { fuzzy: 0 })).toEqual([]);
    expect((await svc.search("omega")).map((h) => h.id)).toEqual(["1"]);

    svc.unindex("1");
    expect(await svc.search("omega")).toEqual([]);
  });

  it("P10 leaves banished items out of default search, and brings them back on undo", async () => {
    const s = new MemoryStorage();
    await s.put("docs", { id: "1", text: "haunted house", updatedAt: "1" });
    await s.put("docs", { id: "2", text: "haunted attic", updatedAt: "1" });
    const svc = makeService(s);
    await svc.load();

    const { undoToken } = await banishItems(s, "docs", ["1"], NOW);
    expect((await svc.search("haunted")).map((h) => h.id)).toEqual(["2"]);
    expect(
      (await svc.search("haunted", { includeBanished: true })).map((h) => h.id).sort(),
    ).toEqual(["1", "2"]);

    await undoBanish(s, undoToken);
    expect((await svc.search("haunted")).map((h) => h.id).sort()).toEqual(["1", "2"]);
  });

  it("restores a saved index when nothing changed, and rebuilds when an item changed", async () => {
    const s = new MemoryStorage();
    await s.put("docs", { id: "1", text: "ghost story", updatedAt: "1" });

    expect(await makeService(s).load()).toBe("rebuilt");
    const again = makeService(s);
    expect(await again.load()).toBe("restored");
    expect((await again.search("ghost")).map((h) => h.id)).toEqual(["1"]);

    // Another process edits the item. The saved index is now stale.
    await s.put("docs", { id: "1", text: "friendly spirit", updatedAt: "2" });
    const stale = makeService(s);
    expect(await stale.load()).toBe("rebuilt");
    expect(await stale.search("ghost", { fuzzy: 0 })).toEqual([]);
    expect((await stale.search("spirit")).map((h) => h.id)).toEqual(["1"]);
  });

  it("recovers from a damaged saved index", async () => {
    const s = new MemoryStorage();
    await s.put("docs", { id: "1", text: "ghost", updatedAt: "1" });
    await makeService(s).load();
    const saved = (await s.get("searchIndex", "docs"))!;
    await s.put("searchIndex", { ...saved, index: { garbage: true } });
    const svc = makeService(s);
    expect(await svc.load()).toBe("rebuilt");
    expect((await svc.search("ghost")).map((h) => h.id)).toEqual(["1"]);
  });

  it("flush saves changes made through index()", async () => {
    const s = new MemoryStorage();
    const svc = makeService(s);
    await svc.load();
    const item = { id: "1", text: "late arrival", updatedAt: "1" };
    await s.put("docs", item);
    svc.index(item);
    await svc.flush();
    const next = makeService(s);
    expect(await next.load()).toBe("restored");
    expect((await next.search("arrival")).map((h) => h.id)).toEqual(["1"]);
  });
});

describe("P6 search matches a brute-force oracle", () => {
  const word = fc.stringMatching(/^[a-z]{1,5}$/);
  const doc = fc.record({
    title: fc.array(word, { maxLength: 4 }),
    text: fc.array(word, { maxLength: 8 }),
  });

  it("for exact-word queries the result set equals the docs containing every query word", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(doc, { minLength: 1, maxLength: 12 }),
        fc.array(word, { minLength: 1, maxLength: 3 }),
        async (docs, queryWords) => {
          const s = new MemoryStorage();
          const stored: (StoredItem & { words: Set<string> })[] = [];
          for (const [i, d] of docs.entries()) {
            const item = {
              id: `d${i}`,
              title: d.title.join(" "),
              text: d.text.join(" "),
              updatedAt: "1",
            };
            await s.put("docs", item);
            stored.push({ ...item, words: new Set([...d.title, ...d.text]) });
          }
          const svc = makeService(s);
          await svc.load();

          const oracle = stored
            .filter((d) => queryWords.every((w) => d.words.has(w)))
            .map((d) => d.id)
            .sort();
          const hits = await svc.search(queryWords.join(" "), {
            prefix: false,
            fuzzy: 0,
            limit: 1000,
          });
          expect(hits.map((h) => h.id).sort()).toEqual(oracle);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("prefix search never misses an exact match", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(doc, { minLength: 1, maxLength: 10 }), word, async (docs, w) => {
        const s = new MemoryStorage();
        const containing: string[] = [];
        for (const [i, d] of docs.entries()) {
          const item = {
            id: `d${i}`,
            title: d.title.join(" "),
            text: d.text.join(" "),
            updatedAt: "1",
          };
          await s.put("docs", item);
          if ([...d.title, ...d.text].includes(w)) containing.push(item.id);
        }
        const svc = makeService(s);
        await svc.load();
        const exact = (await svc.search(w, { prefix: false, fuzzy: 0, limit: 1000 })).map(
          (h) => h.id,
        );
        const withPrefix = (await svc.search(w, { prefix: true, fuzzy: 0, limit: 1000 })).map(
          (h) => h.id,
        );
        expect(exact.sort()).toEqual(containing.sort());
        for (const id of exact) expect(withPrefix).toContain(id);
      }),
      { numRuns: 100 },
    );
  });
});
