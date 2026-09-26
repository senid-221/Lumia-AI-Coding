import path from "node:path";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { listProjectFiles, readProjectFile } from "./project-files";
import { runProjectCommand } from "./command-runner";
import { loadProjectRules } from "./rule-loader";

export type ProjectContextSnapshot = {
  projectId: string; inspectedAt: string;
  structure: { files: string[]; totalVisibleFiles: number; truncated: boolean };
  stack: { languages: string[]; frameworks: string[]; packageManager: string | null; runtime: string | null };
  manifest: { name: string | null; scripts: string[]; dependencies: string[]; devDependencies: string[] };
  database: { prisma: boolean; migrations: boolean; schemaFiles: string[] };
  git: { available: boolean; status: string };
  rules: { loaded: boolean; bytes: number };
};

const MAX_FILES = 400;
const MAX_MANIFEST_ITEMS = 80;
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_MEMORY_KEY = "project-context:snapshot";
const SNAPSHOT_MAX_BYTES = 20000;

function unique(values: string[]) { return [...new Set(values)].sort(); }

async function readJson(projectId: string, file: string): Promise<any | null> {
  try { return JSON.parse(await readProjectFile(projectId, file)); } catch { return null; }
}

function detectPackageManager(files: string[]) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("package-lock.json")) return "npm";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  return files.includes("package.json") ? "npm" : null;
}

function detectStack(files: string[], pkg: any | null) {
  const all = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const frameworks: string[] = [];
  if (all.next || files.some(f => f.startsWith("app/") || f.startsWith("pages/"))) frameworks.push("Next.js");
  if (all.react || all["react-dom"]) frameworks.push("React");
  if (all.vite) frameworks.push("Vite");
  if (all.express) frameworks.push("Express");
  if (all.fastify) frameworks.push("Fastify");
  if (all["@prisma/client"] || files.includes("prisma/schema.prisma")) frameworks.push("Prisma");
  if (all.typescript || files.includes("tsconfig.json")) frameworks.push("TypeScript");
  if (all.tailwindcss || files.some(f => f.includes("tailwind"))) frameworks.push("Tailwind CSS");
  const extMap: Record<string,string> = { ".ts":"TypeScript",".tsx":"TypeScript",".js":"JavaScript",".jsx":"JavaScript",".py":"Python",".go":"Go",".rs":"Rust",".java":"Java",".kt":"Kotlin",".php":"PHP",".rb":"Ruby",".sql":"SQL" };
  const languages = files.map(f => extMap[path.extname(f).toLowerCase()]).filter(Boolean) as string[];
  if (files.includes("package.json") && !languages.length) languages.push("JavaScript");
  return { languages: unique(languages), frameworks: unique(frameworks) };
}

function snapshotFingerprint(context: Omit<ProjectContextSnapshot, "inspectedAt">) {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

async function persistProjectSnapshot(context: ProjectContextSnapshot) {
  const stable = {
    version: SNAPSHOT_VERSION,
    projectId: context.projectId,
    structure: context.structure,
    stack: context.stack,
    manifest: context.manifest,
    database: context.database,
    git: context.git,
    rules: context.rules
  };
  const fingerprint = snapshotFingerprint(stable);
  const content = JSON.stringify({ version: SNAPSHOT_VERSION, fingerprint, inspectedAt: context.inspectedAt, context: stable });
  if (Buffer.byteLength(content, "utf8") > SNAPSHOT_MAX_BYTES) return;
  const existing = await prisma.projectMemory.findUnique({
    where: { projectId_key: { projectId: context.projectId, key: SNAPSHOT_MEMORY_KEY } },
    select: { content: true }
  });
  try {
    const previous = existing?.content ? JSON.parse(existing.content) : null;
    if (previous?.fingerprint === fingerprint && previous?.version === SNAPSHOT_VERSION) return;
  } catch {}
  await prisma.projectMemory.upsert({
    where: { projectId_key: { projectId: context.projectId, key: SNAPSHOT_MEMORY_KEY } },
    create: { projectId: context.projectId, kind: "project-context", key: SNAPSHOT_MEMORY_KEY, content },
    update: { kind: "project-context", content }
  });
}

export async function loadPersistedProjectSnapshot(projectId: string): Promise<ProjectContextSnapshot | null> {
  const row = await prisma.projectMemory.findUnique({
    where: { projectId_key: { projectId, key: SNAPSHOT_MEMORY_KEY } },
    select: { content: true }
  });
  if (!row?.content) return null;

  try {
    const persisted = JSON.parse(row.content);
    if (
      persisted?.version !== SNAPSHOT_VERSION ||
      persisted?.context?.projectId !== projectId ||
      typeof persisted?.fingerprint !== "string"
    ) {
      return null;
    }

    const context = persisted.context as ProjectContextSnapshot;
    if (
      !context.inspectedAt ||
      !context.structure ||
      !context.stack ||
      !context.manifest ||
      !context.database ||
      !context.git ||
      !context.rules
    ) {
      return null;
    }

    return context;
  } catch {
    return null;
  }
}

export async function getProjectContextSnapshot(projectId: string): Promise<ProjectContextSnapshot> {
  const persisted = await loadPersistedProjectSnapshot(projectId);
  if (persisted) return persisted;

  return inspectProjectContext(projectId);
}

export async function inspectProjectContext(projectId: string): Promise<ProjectContextSnapshot> {
  const rawFiles = await listProjectFiles(projectId, ".");
  const files = rawFiles.filter(f => !f.endsWith("/")).slice(0, MAX_FILES);
  const pkg = files.includes("package.json") ? await readJson(projectId, "package.json") : null;
  const stack = detectStack(files, pkg);
  const schemaFiles = files.filter(f => f === "prisma/schema.prisma" || (f.startsWith("prisma/migrations/") && f.endsWith(".sql"))).slice(0, 100);
  let git = { available: false, status: "Git repository not available." };
  try {
    const result = await runProjectCommand(projectId, "git", ["status", "--short", "--branch"]);
    git = { available: result.code === 0, status: (result.stdout || result.stderr).trim().slice(0, 6000) || "Clean working tree." };
  } catch (error) { git = { available: false, status: error instanceof Error ? error.message : "Git inspection failed." }; }
  let rules = "";
  try { rules = await loadProjectRules(projectId, "planner"); } catch {}
  const snapshot: ProjectContextSnapshot = {
    projectId, inspectedAt: new Date().toISOString(),
    structure: { files, totalVisibleFiles: rawFiles.length, truncated: rawFiles.length > MAX_FILES },
    stack: { ...stack, packageManager: detectPackageManager(rawFiles), runtime: pkg?.engines?.node || (files.includes("package.json") ? "Node.js" : null) },
    manifest: { name: typeof pkg?.name === "string" ? pkg.name : null, scripts: Object.keys(pkg?.scripts || {}).slice(0, MAX_MANIFEST_ITEMS), dependencies: Object.keys(pkg?.dependencies || {}).slice(0, MAX_MANIFEST_ITEMS), devDependencies: Object.keys(pkg?.devDependencies || {}).slice(0, MAX_MANIFEST_ITEMS) },
    database: { prisma: schemaFiles.includes("prisma/schema.prisma"), migrations: schemaFiles.some(f => f.startsWith("prisma/migrations/")), schemaFiles },
    git, rules: { loaded: Boolean(rules), bytes: Buffer.byteLength(rules, "utf8") }
  };
  try { await persistProjectSnapshot(snapshot); } catch {}
  return snapshot;
}

export function formatProjectContext(context: ProjectContextSnapshot) {
  return [
    "Project context inspected at " + context.inspectedAt + ".",
    "Stack: " + (context.stack.languages.join(", ") || "unknown") + "; frameworks: " + (context.stack.frameworks.join(", ") || "none detected") + "; runtime: " + (context.stack.runtime || "unknown") + "; package manager: " + (context.stack.packageManager || "none") + ".",
    "Manifest: " + (context.manifest.name || "unknown") + "; scripts: " + (context.manifest.scripts.join(", ") || "none") + ".",
    "Dependencies: " + (context.manifest.dependencies.join(", ") || "none") + ".",
    "Dev dependencies: " + (context.manifest.devDependencies.join(", ") || "none") + ".",
    "Database: Prisma=" + (context.database.prisma ? "yes" : "no") + ", migrations=" + (context.database.migrations ? "yes" : "no") + ".",
    "Git: " + context.git.status,
    "Visible project files (" + context.structure.totalVisibleFiles + (context.structure.truncated ? ", truncated" : "") + "): " + context.structure.files.join(", ")
  ].join("\n");
}