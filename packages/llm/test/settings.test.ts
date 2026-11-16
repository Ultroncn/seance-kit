import fc from "fast-check";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import {
  PROVIDER_PRESETS,
  createProvider,
  listModels,
  loadProviderConfig,
  loadProviderProfiles,
  parseProviderConfig,
  parseProviderProfiles,
  reasoningOptions,
  reasoningParams,
  saveProviderProfiles,
  type ProviderConfig,
  type ProviderProfiles,
} from "../src/index";

const config: fc.Arbitrary<ProviderConfig> = fc.oneof(
  fc.record({ kind: fc.constant("anthropic" as const), apiKey: fc.string(), model: fc.string() }),
  fc.record({
    kind: fc.constant("openai-compatible" as const),
    baseUrl: fc.webUrl(),
    apiKey: fc.string(),
    model: fc.string(),
  }),
  fc.record({ kind: fc.constant("ollama" as const), model: fc.string() }),
);
const profiles: fc.Arbitrary<ProviderProfiles> = fc
  .uniqueArray(
    fc.record({ id: fc.string({ minLength: 1 }), name: fc.string(), preset: fc.string(), config }),
    { selector: (p) => p.id, maxLength: 6 },
  )
  .chain((list) =>
    fc.record({
      profiles: fc.constant(list),
      activeId: list.length
        ? fc.option(fc.constantFrom(...list.map((p) => p.id)))
        : fc.constant(null),
    }),
  );

describe("provider profiles", () => {
  it("P12 provider profiles survive save and load unchanged, and never reach an export", async () => {
    await fc.assert(
      fc.asyncProperty(profiles, async (value) => {
        const s = new MemoryStorage();
        await saveProviderProfiles(s, value);
        expect(await loadProviderProfiles(s)).toEqual(value);
        const exported = await (await s.exportAll()).text();
        for (const p of value.profiles)
          if (p.config.kind !== "ollama" && p.config.apiKey.length > 8)
            expect(exported).not.toContain(p.config.apiKey);
      }),
    );
  });

  it("P12 parsing any input yields valid profiles with a real active id or demo mode", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const out = parseProviderProfiles(raw);
        const ids = out.profiles.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(out.activeId === null || ids.includes(out.activeId)).toBe(true);
      }),
    );
  });

  it("starts in demo mode and migrates a single config saved by an earlier version", async () => {
    const s = new MemoryStorage();
    expect(await loadProviderConfig(s)).toBeNull();
    await s.put("secrets", { id: "provider", kind: "anthropic", apiKey: "sk-test", model: "m" });
    const loaded = await loadProviderProfiles(s);
    expect(loaded.profiles).toHaveLength(1);
    expect(await loadProviderConfig(s)).toEqual({
      kind: "anthropic",
      apiKey: "sk-test",
      model: "m",
    });
    await saveProviderProfiles(s, loaded);
    expect(await s.get("secrets", "provider")).toBeUndefined();
  });

  it("treats damaged or unknown configs as demo mode", async () => {
    const s = new MemoryStorage();
    await s.put("secrets", { id: "provider", kind: "anthropic", apiKey: 42 });
    expect(await loadProviderConfig(s)).toBeNull();
    expect(parseProviderConfig({ kind: "gemini", apiKey: "k" })).toBeNull();
    expect(parseProviderConfig({ kind: "ollama", model: "llama", extra: 1 })).toEqual({
      kind: "ollama",
      model: "llama",
    });
    expect(
      parseProviderConfig({ kind: "anthropic", apiKey: "k", model: "m", baseUrl: "https://x" }),
    ).toEqual({ kind: "anthropic", apiKey: "k", model: "m", baseUrl: "https://x" });
  });

  it("refuses to save an incomplete profile", async () => {
    await expect(
      saveProviderProfiles(new MemoryStorage(), {
        activeId: null,
        profiles: [{ id: "a", name: "A", preset: "x", config: { kind: "anthropic" } as never }],
      }),
    ).rejects.toThrow(/Incomplete/);
  });
});

describe("presets", () => {
  it("have unique ids, https endpoints except local servers, and key links for hosted vendors", () => {
    expect(new Set(PROVIDER_PRESETS.map((p) => p.id)).size).toBe(PROVIDER_PRESETS.length);
    for (const p of PROVIDER_PRESETS) {
      if (p.region === "local") expect(p.baseUrl).toMatch(/^http:\/\/localhost:/);
      else expect(p.baseUrl).toMatch(/^https:\/\//);
      if (p.region === "global" || p.region === "china") expect(p.keyUrl).toMatch(/^https:\/\//);
    }
  });
});

describe("listModels", () => {
  const reply = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

  it("asks the vendor's /models endpoint with the right auth and returns sorted unique ids", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fake = async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> });
      return reply({ data: [{ id: "b" }, { id: "a" }, { id: "b" }, { nope: 1 }] })();
    };
    expect(
      await listModels(
        { kind: "openai-compatible", baseUrl: "https://api.deepseek.com/", apiKey: "k", model: "" },
        fake,
      ),
    ).toEqual([{ id: "a" }, { id: "b" }]);
    expect(calls[0]).toEqual({
      url: "https://api.deepseek.com/models",
      headers: { authorization: "Bearer k" },
    });
    await listModels(
      { kind: "anthropic", apiKey: "k2", model: "", baseUrl: "https://api.deepseek.com/anthropic" },
      fake,
    );
    expect(calls[1]?.url).toBe("https://api.deepseek.com/anthropic/v1/models?limit=1000");
    expect(calls[1]?.headers["x-api-key"]).toBe("k2");
  });

  it("reports HTTP failures without echoing the key", async () => {
    const fake = async () => new Response("bad key", { status: 401 });
    const err = await listModels(
      { kind: "openai-compatible", baseUrl: "https://x", apiKey: "sk-secret-1", model: "" },
      fake,
    ).catch((e: Error) => e);
    expect(String(err)).toMatch(/HTTP 401/);
    expect(String(err)).not.toContain("sk-secret-1");
  });
});

describe("reasoning levels", () => {
  it("are offered per vendor and model, and never for models without them", () => {
    expect(reasoningOptions("deepseek", "deepseek-v4-pro")?.levels).toEqual([
      "off",
      "low",
      "high",
      "max",
    ]);
    expect(reasoningOptions("anthropic", "claude-opus-4-7")?.levels).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect(reasoningOptions("anthropic", "claude-3-haiku-20240307")).toBeNull();
    expect(reasoningOptions("openai", "gpt-5.2")?.style).toBe("openai");
    expect(reasoningOptions("openai", "gpt-4o")).toBeNull();
    expect(reasoningOptions("openrouter", "x/y", { id: "x/y", reasoning: true })?.style).toBe(
      "openrouter",
    );
    expect(reasoningOptions("openrouter", "x/z", { id: "x/z" })).toBeNull();
    expect(reasoningOptions("qwen", "qwen-plus")).toBeNull();
    expect(reasoningOptions("deepseek", "")).toBeNull();
  });

  it("are encoded the way each vendor documents", () => {
    expect(reasoningParams({ style: "deepseek", level: "off" })).toEqual({
      thinking: { type: "disabled" },
    });
    expect(reasoningParams({ style: "deepseek", level: "max" })).toEqual({
      thinking: { type: "enabled" },
      reasoning_effort: "max",
    });
    expect(reasoningParams({ style: "anthropic", level: "low" })).toEqual({
      output_config: { effort: "low" },
    });
    expect(reasoningParams({ style: "openrouter", level: "high" })).toEqual({
      reasoning: { effort: "high" },
    });
    expect(reasoningParams(undefined)).toEqual({});
  });

  it("reach the request body, and survive saving with the profile's model list", async () => {
    let body: Record<string, unknown> = {};
    const provider = createProvider(
      {
        kind: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        apiKey: "k",
        model: "m",
        reasoning: { style: "deepseek", level: "low" },
      },
      async (_u, init) => {
        body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
      },
    );
    await provider.complete({ messages: [{ role: "user", content: "hi" }], tools: [] });
    expect(body).toMatchObject({
      model: "m",
      reasoning_effort: "low",
      thinking: { type: "enabled" },
    });
    const s = new MemoryStorage();
    const value: ProviderProfiles = {
      activeId: "a",
      profiles: [
        {
          id: "a",
          name: "DeepSeek",
          preset: "deepseek",
          config: {
            kind: "openai-compatible",
            baseUrl: "https://api.deepseek.com",
            apiKey: "k",
            model: "m",
            reasoning: { style: "deepseek", level: "low" },
          },
          models: [{ id: "m" }, { id: "n", reasoning: true }],
        },
      ],
    };
    await saveProviderProfiles(s, value);
    expect(await loadProviderProfiles(s)).toEqual(value);
  });

  it("OpenRouter's model list marks which models take reasoning", async () => {
    const fake = async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "b", supported_parameters: ["tools", "reasoning"] }, { id: "a" }],
        }),
      );
    expect(
      await listModels(
        {
          kind: "openai-compatible",
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: "k",
          model: "",
        },
        fake,
      ),
    ).toEqual([{ id: "a" }, { id: "b", reasoning: true }]);
  });
});
