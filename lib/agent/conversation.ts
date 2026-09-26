import OpenAI from "openai";
import { modelIdForLabel, type ModelProvider } from "./model-router";
import { LUMIA_CHAT_RULES } from "./policy";
import { detectLanguage, languageInstruction } from "./language-detector";

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
  memoryContext = "",
  onEvent?: (event: { type: string; text?: string; detail?: string }) => void
): Promise<ConversationResult> {
  const model = modelIdForLabel(provider, requestedModel); 
  const systemPrompt = memoryContext ? SYSTEM_PROMPT + "\n\nRelevant long-term memory:\n" + memoryContext : SYSTEM_PROMPT;

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    onEvent?.({ type: "thinking", detail: "Understanding your request..." });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages: [...history.slice(-12), { role: "user", content: input }]
      })
    });
    if (!response.ok || !response.body) {
      const data: any = await response.json().catch(() => ({}));
      throw new Error("Anthropic API error " + response.status + ": " + (data?.error?.message || "Request failed"));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const delta = String(event.delta.text || "");
            text += delta;
            onEvent?.({ type: "delta", text: delta });
          }
        } catch {}
      }
      if (done) break;
    }
    return { text: text.trim() || "I could not produce a response." };
  }

  if (provider === "openai") {
    onEvent?.({ type: "thinking", detail: "Understanding your request..." });
    const stream = await client(provider).responses.create({
      model,
      instructions: systemPrompt + "\\n\\nConversation behavior: Answer naturally like a conversational AI. If the request is underspecified, ask for the missing information before acting. When useful, offer a small set of clear choices. For factual, current, unfamiliar, or potentially uncertain questions, use live web search before answering and ground factual claims in retrieved sources.",
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "auto",
      stream: true,
      input: [...history.slice(-12).map(message => ({
        role: message.role,
        content: message.content
      })), { role: "user" as const, content: input }]
    });
    let text = "";
    for await (const event of stream as any) {
      if (event.type === "response.web_search_call.in_progress") {
        onEvent?.({ type: "thinking", detail: "Researching online..." });
      } else if (event.type === "response.web_search_call.completed") {
        onEvent?.({ type: "thinking", detail: "Reviewing sources..." });
      } else if (event.type === "response.output_text.delta") {
        const delta = String(event.delta || "");
        text += delta;
        onEvent?.({ type: "delta", text: delta });
      }
    }
    return { text: text.trim() || "I could not produce a response." };
  }

  onEvent?.({ type: "thinking", detail: "Understanding your request..." });
  const stream = await client(provider).chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...history.slice(-12),
      { role: "user", content: input }
    ]
  });
  let text = "";
  for await (const chunk of stream as any) {
    const delta = String(chunk.choices?.[0]?.delta?.content || "");
    if (delta) {
      text += delta;
      onEvent?.({ type: "delta", text: delta });
    }
  }

  return {
    text: text.trim() || "I could not produce a response."
  };

}

export function isSimpleConversation(input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return false;
  if (/^(hello+|hi+|hey+|hiya+|howdy|good morning|good afternoon|good evening|thanks+|thank you|ok+|okay+|yo+|sup+)[!.?,\s]*$/i.test(value)) return true;
  if (/^(who are you|what are you|what can you do|help|how are you)[?.!\s]*$/i.test(value)) return true;
  return false;
}
