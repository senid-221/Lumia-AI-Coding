import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

type Provider = "anthropic" | "openai" | "google" | "xai" | "groq";
type Model = { id: string; label: string };

type ProviderState = {
  id: Provider;
  label: string;
  models: Model[];
  configured: boolean;
  error?: string;
};

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error?.message || data?.error || `Provider request failed (${res.status})`));
  }
  return data;
}

function sortModels(models: Model[]) {
  return models.sort((a, b) => a.label.localeCompare(b.label));
}

async function listGoogleModels(apiKey: string): Promise<Model[]> {
  const models: Model[] = [];
  let pageToken = "";

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ pageSize: "1000", key: apiKey });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?${params.toString()}`);

    for (const model of data.models || []) {
      const id = String(model.name || "").replace(/^models\//, "");
      if (id) models.push({ id, label: model.displayName || id });
    }

    pageToken = String(data.nextPageToken || "");
    if (!pageToken) break;
  }

  return sortModels(models);
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers: Record<Provider, ProviderState> = {
    anthropic: {
      id: "anthropic",
      label: "Anthropic",
      models: [],
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    openai: {
      id: "openai",
      label: "OpenAI",
      models: [],
      configured: Boolean(process.env.OPENAI_API_KEY),
    },
    google: {
      id: "google",
      label: "Google",
      models: [],
      configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
    xai: {
      id: "xai",
      label: "xAI",
      models: [],
      configured: Boolean(process.env.XAI_API_KEY),
    },
    groq: {
      id: "groq",
      label: "Groq",
      models: [],
      configured: Boolean(process.env.GROQ_API_KEY),
    },
  };

  const tasks: Promise<void>[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    tasks.push(
      (async () => {
        try {
          const data = await fetchJson("https://api.anthropic.com/v1/models", {
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          });
          providers.anthropic.models = sortModels(
            (data.data || []).map((model: any) => ({
              id: model.id,
              label: model.display_name || model.id,
            })),
          );
        } catch (error) {
          providers.anthropic.error = error instanceof Error ? error.message : "Model listing failed";
        }
      })(),
    );
  }

  if (process.env.OPENAI_API_KEY) {
    tasks.push(
      (async () => {
        try {
          const data = await fetchJson("https://api.openai.com/v1/models", {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
          });
          providers.openai.models = sortModels(
            (data.data || []).map((model: any) => ({
              id: model.id,
              label: model.id,
            })),
          );
        } catch (error) {
          providers.openai.error = error instanceof Error ? error.message : "Model listing failed";
        }
      })(),
    );
  }

  const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (googleKey) {
    tasks.push(
      (async () => {
        try {
          providers.google.models = await listGoogleModels(googleKey);
        } catch (error) {
          providers.google.error = error instanceof Error ? error.message : "Model listing failed";
        }
      })(),
    );
  }

  if (process.env.XAI_API_KEY) {
    tasks.push(
      (async () => {
        try {
          const data = await fetchJson("https://api.x.ai/v1/models", {
            Authorization: `Bearer ${process.env.XAI_API_KEY!}`,
          });
          providers.xai.models = sortModels(
            (data.data || []).map((model: any) => ({
              id: model.id,
              label: model.id,
            })),
          );
        } catch (error) {
          providers.xai.error = error instanceof Error ? error.message : "Model listing failed";
        }
      })(),
    );
  }

  if (process.env.GROQ_API_KEY) {
    tasks.push(
      (async () => {
        try {
          const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
          const data = await fetchJson(`${baseUrl}/models`, {
            Authorization: `Bearer ${process.env.GROQ_API_KEY!}`,
          });
          providers.groq.models = sortModels(
            (data.data || []).map((model: any) => ({
              id: model.id,
              label: model.id,
            })),
          );
        } catch (error) {
          providers.groq.error = error instanceof Error ? error.message : "Model listing failed";
        }
      })(),
    );
  }

  await Promise.all(tasks);

  return NextResponse.json({
    providers: Object.values(providers),
    source: "live-provider-model-apis",
    refreshedAt: new Date().toISOString(),
  });
}
