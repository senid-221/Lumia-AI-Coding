import { LUMIA_CORE_RULES, LUMIA_CHAT_RULES, LUMIA_CODING_RULES, LUMIA_CODING_INSTRUCTIONS } from "./core-rules";

export { LUMIA_CORE_RULES, LUMIA_CHAT_RULES, LUMIA_CODING_RULES, LUMIA_CODING_INSTRUCTIONS };

export const LUMIA_CORE_BEHAVIOR = LUMIA_CORE_RULES.split("\n").filter(Boolean) as readonly string[];

export function looksLikeCodingTask(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return false;
  return /\b(build|create|make|implement|code|coding|fix|debug|repair|refactor|edit|change|update|modify|remove|delete|add|install|run|test|tests|lint|typecheck|compile|deploy)\b/.test(v) ||
    /\b(my|this|the)\s+(website|web app|app|project|repository|repo|file|component|api|database|code|function|endpoint|route)\b/.test(v) ||
    /\b(website|web app|app|project|repository|repo|file|component|api|database|code|function|endpoint|route)\s+(for|with|using|that|which)\b/.test(v);
}

export function looksLikeConversation(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return false;
  if (looksLikeCodingTask(v)) return false;
  return /^(hello|hi|hey|hiya|howdy|good morning|good afternoon|good evening|thanks|thank you|ok|okay|yo|sup|who are you|what are you|what can you do|how are you|why|what|when|where|who|how|can you|could you|would you|tell me|explain|help me)\b/i.test(v) || /[?]$/.test(v);
}
