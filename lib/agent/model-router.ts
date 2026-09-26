export type ModelProvider = "anthropic" | "openai" | "google" | "xai";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
};

export const MODEL_CATALOG: Record<ModelProvider, ModelDefinition[]> = {
  anthropic: [
    { id: process.env.LUMIA_ANTHROPIC_HAIKU_4_5_MODEL || "claude-haiku-4-5-20251001", label: "Haiku 4.5", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_SONNET_4_6_MODEL || "claude-sonnet-4-6", label: "Sonnet 4.6", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_OPUS_4_6_MODEL || "claude-opus-4-6", label: "Opus 4.6", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_OPUS_4_7_MODEL || "claude-opus-4-7", label: "Opus 4.7", provider: "anthropic" }
  ],
  openai: [
    { id: process.env.LUMIA_OPENAI_GPT_5_3_CODEX_MODEL || "gpt-5.3-codex", label: "GPT-5.3 Codex", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_4_MODEL || "gpt-5.4", label: "GPT-5.4", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_4_MINI_MODEL || "gpt-5.4-mini", label: "GPT-5.4-mini", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_5_MODEL || "gpt-5.5", label: "GPT-5.5", provider: "openai" }
  ],
  google: [
    { id: process.env.LUMIA_GOOGLE_GEMINI_PRO_3_1_MODEL || "gemini-3.1-pro-preview", label: "Gemini Pro 3.1", provider: "google" },
    { id: process.env.LUMIA_GOOGLE_GEMINI_FLASH_3_0_MODEL || "gemini-3-flash-preview", label: "Gemini Flash 3.0", provider: "google" }
  ],
  xai: [
    { id: process.env.LUMIA_XAI_GROK_CODE_FAST_1_MODEL || "grok-build-0.1", label: "Grok Code Fast 1", provider: "xai" }
  ]
};

export function modelIdForLabel(provider: ModelProvider, value?: string) {
  const models = MODEL_CATALOG[provider];
  return models.find(m => m.id === value || m.label === value)?.id || value || models[0].id;
}

export function hasProviderKey(provider: ModelProvider) {
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "google") return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return Boolean(process.env.XAI_API_KEY);
}
