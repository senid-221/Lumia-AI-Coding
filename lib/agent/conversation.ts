import OpenAI from "openai";
import { modelIdForLabel, type ModelProvider } from "./model-router";
import { LUMIA_CHAT_RULES } from "./policy";

export type ConversationResult = { text: string };

const SYSTEM_PROMPT = [
  ...LUMIA_CHAT_RULES,
  "You are currently running in normal conversation mode.",
  "Do not inspect, edit, build, test, or plan a project in this mode.",
  "If the user requests project changes, the application should route that request to coding mode."
].join("\n");

function client(provider: Exclude<ModelProvider, "anthropic">) {
  if (provider === "openai") return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (provider === "google") return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
  });
  if (provider === "xai") return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: process.env.XAI_BASE_URL || "https://api.x.ai/v1"
  });
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
  });
}

export async function runConversationalProvider(
  provider: ModelProvider,
  requestedModel: string | undefined,
  input: string,
  history: { role: "user" | "assistant"; content: string }[],
  memoryContext = ""
): Promise<ConversationResult> {
  const model = modelIdForLabel(provider, requestedModel); 
  const systemPrompt = memoryContext ? SYSTEM_PROMPT + "\n\nRelevant long-term memory:\n" + memoryContext : SYSTEM_PROMPT;

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [...history.slice(-12), { role: "user", content: input }]
      })
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error("Anthropic API error " + response.status + ": " + (data?.error?.message || "Request failed"));
    }
    const text = (data.content || [])
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n")
      .trim();
    return { text: text || "Hello! How can I help you today?" };
  }

  if (provider === "openai") {
    const response = await client(provider).responses.create({
      model,
      instructions: systemPrompt,
      input: [...history.slice(-12).map(message => ({
        role: message.role,
        content: message.content
      })), { role: "user" as const, content: input }]
    });
    return {
      text: String(response.output_text || "Hello! How can I help you today?")
    };
  }

  const response = await client(provider).chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history.slice(-12),
      { role: "user", content: input }
    ]
  });

  return {
    text: String(response.choices?.[0]?.message?.content || "Hello! How can I help you today?")
  };
}

export function isSimpleConversation(input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return false;
  if (/^(hello+|hi+|hey+|hiya+|howdy|good morning|good afternoon|good evening|thanks+|thank you|ok+|okay+|yo+|sup+)[!.?,\s]*$/i.test(value)) return true;
  if (/^(who are you|what are you|what can you do|help|how are you)[?.!\s]*$/i.test(value)) return true;
  return false;
}
