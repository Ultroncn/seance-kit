import type { ProviderProfile } from "@seance/llm";
import { describe, expect, it } from "vitest";
import { withModelChoice } from "../src/index";

const deepseek: ProviderProfile = {
  id: "d",
  name: "DeepSeek",
  preset: "deepseek",
  config: {
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    apiKey: "k",
    model: "deepseek-v4-pro",
    reasoning: { style: "deepseek", level: "max" },
  },
  models: [{ id: "deepseek-v4-pro" }, { id: "deepseek-v4-flash" }],
};
const claude: ProviderProfile = {
  id: "c",
  name: "Claude",
  preset: "anthropic",
  config: {
    kind: "anthropic",
    apiKey: "k",
    model: "claude-opus-4-7",
    reasoning: { style: "anthropic", level: "high" },
  },
};

describe("model picker choices", () => {
  it("keeps the level when the new model offers it", () => {
    expect(withModelChoice(deepseek, "deepseek-v4-flash").config).toMatchObject({
      model: "deepseek-v4-flash",
      reasoning: { style: "deepseek", level: "max" },
    });
  });

  it("drops the level when the new model has no reasoning levels", () => {
    const next = withModelChoice(claude, "claude-3-haiku-20240307");
    expect(next.config.model).toBe("claude-3-haiku-20240307");
    expect(next.config).not.toHaveProperty("reasoning");
  });

  it("sets and clears a level, and refuses one the model does not offer", () => {
    expect(withModelChoice(claude, "claude-opus-4-7", "low").config).toMatchObject({
      reasoning: { style: "anthropic", level: "low" },
    });
    expect(withModelChoice(claude, "claude-opus-4-7", null).config).not.toHaveProperty("reasoning");
    expect(withModelChoice(claude, "claude-opus-4-7", "max").config).not.toHaveProperty(
      "reasoning",
    );
  });
});
