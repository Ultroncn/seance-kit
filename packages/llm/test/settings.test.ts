import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import {
  clearProviderConfig,
  loadProviderConfig,
  parseProviderConfig,
  saveProviderConfig,
} from "../src/index";

describe("provider settings", () => {
  it("starts in demo mode, saves, reloads and clears a config", async () => {
    const s = new MemoryStorage();
    expect(await loadProviderConfig(s)).toBeNull();
    await saveProviderConfig(s, { kind: "anthropic", apiKey: "sk-test", model: "m" });
    expect(await loadProviderConfig(s)).toEqual({
      kind: "anthropic",
      apiKey: "sk-test",
      model: "m",
    });
    await clearProviderConfig(s);
    expect(await loadProviderConfig(s)).toBeNull();
  });

  it("keeps the key out of exports", async () => {
    const s = new MemoryStorage();
    await saveProviderConfig(s, {
      kind: "openai-compatible",
      baseUrl: "https://x",
      apiKey: "sk-secret",
      model: "m",
    });
    expect(await (await s.exportAll()).text()).not.toContain("sk-secret");
  });

  it("treats damaged or unknown configs as demo mode", async () => {
    const s = new MemoryStorage();
    await s.put("secrets", { id: "provider", kind: "anthropic", apiKey: 42 });
    expect(await loadProviderConfig(s)).toBeNull();
    expect(parseProviderConfig({ kind: "gemini", apiKey: "k" })).toBeNull();
    expect(parseProviderConfig(null)).toBeNull();
    expect(parseProviderConfig({ kind: "ollama", model: "llama", extra: 1 })).toEqual({
      kind: "ollama",
      model: "llama",
    });
  });

  it("refuses to save an incomplete config", async () => {
    await expect(
      saveProviderConfig(new MemoryStorage(), { kind: "anthropic" } as never),
    ).rejects.toThrow(/Incomplete/);
  });
});
