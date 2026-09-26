import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot, safePath } from "./workspace";
import type { SpecialistRole } from "./specialists";

const MAX_RULE_BYTES = Number(process.env.LUMIA_RULE_FILE_BYTES || 100_000);
const RULE_FILES = [
  "AGENTS.md",
  ".lumia/rules/core.md",
  ".lumia/rules/coding.md",
  ".lumia/rules/security.md",
  ".lumia/rules/frontend.md",
  ".lumia/rules/backend.md",
  ".lumia/rules/database.md",
  ".lumia/rules/testing.md",
  ".lumia/rules/deployment.md",
  ".lumia/rules/research.md",
  ".lumia/rules/tool-permissions.md",
  ".lumia/rules/memory.md",
  ".lumia/rules/context.md",
  ".lumia/rules/agents.md",
  ".lumia/rules/verification.md",
  ".lumia/rules/communication.md"
] as const;

const ROLE_FILES: Record<SpecialistRole, string> = {
  planner: ".lumia/agents/planner.md",
  coder: ".lumia/agents/coder.md",
  reviewer: ".lumia/agents/reviewer.md",
  debugger: ".lumia/agents/debugger.md",
  verifier: ".lumia/agents/verifier.md",
  researcher: ".lumia/agents/researcher.md",
  "security-reviewer": ".lumia/agents/security-reviewer.md",
  "ui-specialist": ".lumia/agents/ui-specialist.md",
  "database-specialist": ".lumia/agents/database-specialist.md"
};

async function readRule(projectId: string, relativePath: string) {
  try {
    const file = safePath(projectId, relativePath);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_RULE_BYTES) return "";
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function loadProjectRules(projectId: string, role: SpecialistRole) {
  const root = projectRoot(projectId);
  const parts: string[] = [];
  for (const file of RULE_FILES) {
    const value = await readRule(projectId, file);
    if (value.trim()) parts.push(`FILE: ${path.relative(root, safePath(projectId, file))}\n${value.trim()}`);
  }
  const roleFile = await readRule(projectId, ROLE_FILES[role]);
  if (roleFile.trim()) parts.push(`FILE: ${path.relative(root, safePath(projectId, ROLE_FILES[role]))}\n${roleFile.trim()}`);
  return parts.join("\n\n").slice(0, 30000);
}
