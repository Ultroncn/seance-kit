import fc from "fast-check";
import { MemoryStorage, type StoredItem } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { banishItems, isBanished, listActive, undoBanish } from "../src/index";

const NOW = new Date("2026-11-16T12:00:00Z");

describe("banish and undo", () => {
  it("hides items from the active list without deleting them, and undo restores them", async () => {
    const s = new MemoryStorage();
    await s.put("chats", { id: "a", title: "A" });
    await s.put("chats", { id: "b", title: "B" });
    const res = await banishItems(s, "chats", ["a", "missing"], NOW);
    expect(res.banished).toEqual(["a"]);
    expect(res.skipped).toEqual(["missing"]);
    expect((await listActive(s, "chats")).map((i) => i.id)).toEqual(["b"]);
    expect(isBanished((await s.get("chats", "a"))!)).toBe(true);

    const undone = await undoBanish(s, res.undoToken);
    expect(undone.restored).toEqual(["a"]);
    expect(await s.get("chats", "a")).toEqual({ id: "a", title: "A" });
  });

  it("does not undo twice, and keeps edits made after the banish", async () => {
    const s = new MemoryStorage();
    await s.put("chats", { id: "a", title: "A" });
    const { undoToken } = await banishItems(s, "chats", ["a"], NOW);
    expect((await undoBanish(s, undoToken)).restored).toEqual(["a"]);
    await s.put("chats", { id: "a", title: "Edited" });
    expect(await undoBanish(s, undoToken)).toEqual({ restored: [], skipped: [] });
    expect(await s.get("chats", "a")).toEqual({ id: "a", title: "Edited" });
  });

  it("leaves an item alone when a later batch banished it again", async () => {
    const s = new MemoryStorage();
    await s.put("chats", { id: "a" });
    const first = await banishItems(s, "chats", ["a"], NOW);
    await undoBanish(s, first.undoToken);
    const second = await banishItems(s, "chats", ["a"], new Date(NOW.getTime() + 1000));
    expect(await undoBanish(s, first.undoToken)).toEqual({ restored: [], skipped: [] });
    expect(isBanished((await s.get("chats", "a"))!)).toBe(true);
    expect((await undoBanish(s, second.undoToken)).restored).toEqual(["a"]);
  });

  it("P10 banish then undo restores every item exactly, and banished items are never active", async () => {
    const item = fc.record({
      id: fc.string({ minLength: 1 }),
      data: fc.jsonValue(),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(item, { selector: (i) => i.id, maxLength: 10 }),
        fc.array(fc.nat(), { maxLength: 10 }),
        async (items, picks) => {
          const s = new MemoryStorage();
          for (const i of items) await s.put("things", i as StoredItem);
          const before = await s.list("things");
          const ids = items.length === 0 ? [] : picks.map((p) => items[p % items.length]!.id);

          const { undoToken, banished } = await banishItems(s, "things", ids, NOW);

          const active = await listActive(s, "things");
          for (const a of active) expect(banished).not.toContain(a.id);
          expect(active.length + banished.length).toBe(items.length);
          expect((await s.list("things")).length).toBe(items.length);

          await undoBanish(s, undoToken);
          expect(await s.list("things")).toEqual(before);
        },
      ),
      { numRuns: 150 },
    );
  });
});
