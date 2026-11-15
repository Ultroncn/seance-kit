import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MemoryStorage, importExportFile, parseExportFile } from "../src/index";

describe("export file", () => {
  it("P5 export, wipe, import restores everything", async () => {
    const item = fc.record({ id: fc.string({ minLength: 1 }), data: fc.jsonValue() });
    const collections = fc.dictionary(
      fc.stringMatching(/^[a-z][a-z0-9_-]{0,8}$/),
      fc.uniqueArray(item, { selector: (i) => i.id, maxLength: 6 }),
      { maxKeys: 4 },
    );
    await fc.assert(
      fc.asyncProperty(collections, async (cols) => {
        const a = new MemoryStorage();
        for (const [name, items] of Object.entries(cols)) {
          for (const i of items) await a.put(name, i);
        }
        const text = await (await a.exportAll()).text();

        const b = new MemoryStorage();
        await b.put("stale", { id: "x" });
        await b.wipe();
        await importExportFile(b, parseExportFile(text));

        expect(await (await b.exportAll()).text()).toBe(text);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects things that are not export files", () => {
    expect(() => parseExportFile("nope")).toThrow(/valid JSON/);
    expect(() => parseExportFile("{}")).toThrow(/version/);
    expect(() => parseExportFile('{"version":1,"collections":[]}')).toThrow(/collections/);
    expect(() => parseExportFile('{"version":1,"collections":{"../x":[]}}')).toThrow(TypeError);
    expect(() => parseExportFile('{"version":1,"collections":{"a":[{"no":"id"}]}}')).toThrow(
      TypeError,
    );
  });
});
