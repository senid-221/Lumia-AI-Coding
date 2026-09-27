import { LUMIA_CORE_RULES, LUMIA_CHAT_RULES, LUMIA_CODING_RULES, LUMIA_CODING_INSTRUCTIONS } from "./core-rules";

export type LumiaMode = "conversation" | "coding";

export type LumiaAgent =
  | "ai-agent"
  | "hacking-lab"
  | "planner"
  | "coder"
  | "reviewer"
  | "debugger"
  | "verifier"
  | "researcher"
  | "security-reviewer"
  | "ui-specialist"
  | "database-specialist";

export { LUMIA_CORE_RULES, LUMIA_CHAT_RULES, LUMIA_CODING_RULES, LUMIA_CODING_INSTRUCTIONS };

export const LUMIA_CORE_BEHAVIOR = LUMIA_CORE_RULES.split("\n").filter(Boolean) as readonly string[];

const CODING_ACTION = /\b(build|create|make|implement|code|coding|fix|debug|repair|refactor|edit|change|update|modify|remove|delete|add|install|run|test|tests|lint|typecheck|compile|deploy|migrate|commit)\b/i;
const PROJECT_TARGET = /\b(my|this|the|a|an)\s+(website|web app|app|project|repository|repo|file|component|api|database|code|function|endpoint|route|page|frontend|backend|schema|migration)\b/i;
const PROJECT_REFERENCE = /\b(website|web app|app|project|repository|repo|file|component|api|database|code|function|endpoint|route|page|frontend|backend|schema|migration)\b/i;

export function looksLikeCodingTask(input: string) {
  const v = input.trim();
  if (!v) return false;

  // A concrete request to change, inspect, run, test, or deploy software is coding.
  if (CODING_ACTION.test(v) && (PROJECT_REFERENCE.test(v) || /\b(it|this|that|the)\b/i.test(v))) return true;
  if (PROJECT_TARGET.test(v)) return true;
  if (/\b(open|inspect|check|review|look at|show me)\b.*\b(code|repo|repository|file|project|website|app)\b/i.test(v)) return true;

  // Questions about programming concepts remain normal conversation unless they
  // explicitly ask Lumia to act on a project.
  return false;
}

export function looksLikeConversation(input: string) {
  const v = input.trim();
  if (!v || looksLikeCodingTask(v)) return false;
  return true;
}

export function classifyRequest(input: string, requestedAgent: LumiaAgent = "ai-agent"): LumiaMode {
  if (requestedAgent !== "ai-agent") return "coding";
  return looksLikeCodingTask(input) ? "coding" : "conversation";
}

export function isCodingAgent(agent: string): agent is Exclude<LumiaAgent, "ai-agent"> {
  return agent !== "ai-agent";
}
