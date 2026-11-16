import type { ProviderKind } from "./factory";

/**
 * Whether a web page may call the vendor directly. Checked on Nov 16, 2026 with a CORS preflight
 * from the deployed origin (no key sent). "blocked" vendors answer without
 * Access-Control-Allow-Origin, so a browser refuses the response; reach their models through an
 * aggregator such as SiliconFlow or OpenRouter instead.
 */
export type BrowserAccess = "ok" | "unverified" | "blocked";

export interface ProviderPreset {
  id: string;
  /** Brand name, shown as is in every language. */
  name: string;
  region: "global" | "china" | "local" | "custom";
  protocol: ProviderKind;
  /** Prefilled and editable. For Ollama this is the host. */
  baseUrl: string;
  /** Where to create a key. Omitted for local servers. */
  keyUrl?: string;
  access: BrowserAccess;
  /** Long-lived aliases only. "Load model list" fetches the current names from the vendor. */
  models?: string[];
  /** False for local servers that need no key. */
  needsKey: boolean;
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  // International
  {
    id: "openai",
    name: "OpenAI",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    access: "ok",
    needsKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    region: "global",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    keyUrl: "https://console.anthropic.com/settings/keys",
    access: "ok",
    needsKey: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    access: "ok",
    needsKey: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    access: "unverified",
    needsKey: true,
  },
  {
    id: "groq",
    name: "Groq",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    access: "ok",
    needsKey: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
    access: "ok",
    needsKey: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    region: "global",
    protocol: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    keyUrl: "https://console.x.ai",
    access: "ok",
    needsKey: true,
  },
  // China
  {
    id: "deepseek",
    name: "DeepSeek",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    keyUrl: "https://platform.deepseek.com/api_keys",
    access: "ok",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsKey: true,
  },
  {
    id: "qwen",
    name: "通义千问 Qwen (DashScope)",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    keyUrl: "https://bailian.console.aliyun.com/",
    access: "ok",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    needsKey: true,
  },
  {
    id: "doubao",
    name: "豆包 Doubao (Volcengine Ark)",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    keyUrl: "https://console.volcengine.com/ark",
    access: "ok",
    needsKey: true,
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    keyUrl: "https://cloud.siliconflow.cn/account/ak",
    access: "ok",
    needsKey: true,
  },
  {
    id: "qianfan",
    name: "百度千帆 Qianfan",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://qianfan.baidubce.com/v2",
    keyUrl: "https://console.bce.baidu.com/qianfan/",
    access: "ok",
    needsKey: true,
  },
  {
    id: "minimax",
    name: "MiniMax",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://api.minimaxi.com/v1",
    keyUrl: "https://platform.minimaxi.com",
    access: "unverified",
    needsKey: true,
  },
  {
    id: "hunyuan",
    name: "腾讯混元 Hunyuan",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    keyUrl: "https://console.cloud.tencent.com/hunyuan",
    access: "unverified",
    needsKey: true,
  },
  {
    id: "moonshot",
    name: "Kimi (Moonshot)",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    keyUrl: "https://platform.moonshot.cn/console/api-keys",
    access: "blocked",
    needsKey: true,
  },
  {
    id: "zhipu",
    name: "智谱 GLM (Zhipu)",
    region: "china",
    protocol: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    access: "blocked",
    needsKey: true,
  },
  // On this machine
  {
    id: "ollama",
    name: "Ollama",
    region: "local",
    protocol: "ollama",
    baseUrl: "http://localhost:11434",
    access: "ok",
    needsKey: false,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    region: "local",
    protocol: "openai-compatible",
    baseUrl: "http://localhost:1234/v1",
    access: "ok",
    needsKey: false,
  },
  // Anything else
  {
    id: "custom-openai",
    name: "Custom (OpenAI-compatible)",
    region: "custom",
    protocol: "openai-compatible",
    baseUrl: "https://",
    access: "unverified",
    needsKey: true,
  },
  {
    id: "custom-anthropic",
    name: "Custom (Anthropic-compatible)",
    region: "custom",
    protocol: "anthropic",
    baseUrl: "https://",
    access: "unverified",
    needsKey: true,
  },
];

export const presetById = (id: string): ProviderPreset | undefined =>
  PROVIDER_PRESETS.find((p) => p.id === id);
