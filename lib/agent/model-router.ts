export type ModelProvider = "anthropic" | "openai" | "google" | "xai" | "zencode";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  env?: string;
};

export const MODEL_CATALOG: Record<Exclude<ModelProvider, "zencode">, ModelDefinition[]> = {
  anthropic: [
    { id: process.env.LUMIA_ANTHROPIC_HAIKU_4_5_MODEL || "Haiku 4.5", label: "Haiku 4.5", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_SONNET_4_6_MODEL || "Sonnet 4.6", label: "Sonnet 4.6", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_OPUS_4_6_MODEL || "Opus 4.6", label: "Opus 4.6", provider: "anthropic" },
    { id: process.env.LUMIA_ANTHROPIC_OPUS_4_7_MODEL || "Opus 4.7", label: "Opus 4.7", provider: "anthropic" }
  ],
  openai: [
    { id: process.env.LUMIA_OPENAI_GPT_5_3_CODEX_MODEL || "GPT-5.3 Codex", label: "GPT-5.3 Codex", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_4_MODEL || "GPT-5.4", label: "GPT-5.4", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_4_MINI_MODEL || "GPT-5.4-mini", label: "GPT-5.4-mini", provider: "openai" },
    { id: process.env.LUMIA_OPENAI_GPT_5_5_MODEL || "GPT-5.5", label: "GPT-5.5", provider: "openai" }
  ],
  google: [
    { id: process.env.LUMIA_GOOGLE_GEMINI_PRO_3_1_MODEL || "Gemini Pro 3.1", label: "Gemini Pro 3.1", provider: "google" },
    { id: process.env.LUMIA_GOOGLE_GEMINI_FLASH_3_0_MODEL || "Gemini Flash 3.0", label: "Gemini Flash 3.0", provider: "google" }
  ],
  xai: [
    { id: process.env.LUMIA_XAI_GROK_CODE_FAST_1_MODEL || "Grok Code Fast 1", label: "Grok Code Fast 1", provider: "xai" }
  ]
};

export const ZENCODER_MODES = [
  { id: "auto", label: "Auto" },
  { id: "auto-plus", label: "Auto+" }
] as const;

export function modelsForProvider(provider: ModelProvider) {
  if (provider === "zencode") return ZENCODER_MODES.map(x => ({ ...x, provider }));
  return MODEL_CATALOG[provider];
}

export function providerFromModel(model: string): Exclude<ModelProvider, "zencode"> | null {
  for (const [provider, models] of Object.entries(MODEL_CATALOG)) {
    if (models.some(m => m.id === model || m.label === model)) return provider as Exclude<ModelProvider, "zencode">;
  }
  return null;
}

export function hasProviderKey(provider: Exclude<ModelProvider, "zencode">) {
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "google") return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return Boolean(process.env.XAI_API_KEY);
}

export function resolveZencoderMode(mode?: string, role?: string) {
  const requested = String(mode || "auto").toLowerCase();
  const enabled: Exclude<ModelProvider, "zencode">[] = ["anthropic", "openai", "google", "xai"];
  const available = enabled.filter(hasProviderKey);
  if (!available.length) {
    throw new Error("Zencoder Auto requires at least one configured provider key: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY, or XAI_API_KEY.");
  }

  const preferred = requested === "auto-plus"
    ? (["anthropic", "openai", "google", "xai"] as const)
    : (["openai", "anthropic", "google", "xai"] as const);

  let selected = preferred.find(p => available.includes(p))!;
  if (requested === "auto-plus") {
    const rolePreference: Record<string, Exclude<ModelProvider, "zencode">[]> = {
      planner: ["anthropic", "openai", "google", "xai"],
      coder: ["google", "openai", "anthropic", "xai"],
      reviewer: ["openai", "anthropic", "google", "xai"],
      debugger: ["xai", "openai", "anthropic", "google"],
      verifier: ["openai", "google", "anthropic", "xai"]
    };
    selected = (rolePreference[role || ""] || preferred).find(p => available.includes(p))!;
  }
  const models = MODEL_CATALOG[selected];
  const model = requested === "auto-plus"
    ? models[models.length - 1]
    : models[Math.min(1, models.length - 1)];

  return { provider: selected, model: model.id, label: model.label, mode: requested === "auto-plus" ? "Auto+" : "Auto" };
}
