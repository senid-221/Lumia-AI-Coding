import { prisma } from "@/lib/prisma";
import { getProjectContext, upsertProjectMemory, rememberExplicitUserContext } from "./memory";
import { runModelProvider } from "./provider";
import type { ModelProvider } from "./model-router";
import { TOOL_DEFINITIONS } from "./tools";
import { SPECIALISTS, specialistPrompt, type SpecialistRole } from "./specialists";

type ContextMessage = { role: "user" | "assistant"; content: string };
export type ProviderId = ModelProvider;

export async function runAutonomousCodingTask(
  projectId: string,
  conversationId: string,
  prompt: string,
  history: ContextMessage[],
  onEvent: (event: any) => void,
  existingExecutionId?: string,
  provider: ProviderId = "openai",
  model?: string
) {
  const specialistTurns = Math.max(1, Math.min(Number(process.env.LUMIA_SPECIALIST_TURNS || 4), 8));
  const projectContext = await getProjectContext(projectId, conversationId);
  if (projectContext.project?.userId) await rememberExplicitUserContext(projectContext.project.userId, prompt);
  const effectiveHistory = projectContext.history.length ? projectContext.history : history;
  const contextSummary = [
    projectContext.project ? `Project: ${projectContext.project.name} (${projectContext.project.slug})` : "",
    projectContext.memories.length
      ? "Project memory:\n" + projectContext.memories.map(m => `[${m.kind}] ${m.key}: ${m.content}`).join("\n")
      : "",
    projectContext.userMemories?.length
      ? "User memory:\n" + projectContext.userMemories.map(m => `[${m.kind}] ${m.key}: ${m.content}`).join("\n")
      : "",
    projectContext.executions.length
      ? "Recent executions:\n" + projectContext.executions.map(e => `[${e.status}] ${e.prompt.slice(0, 240)}${e.error ? ` -> ${e.error}` : ""}`).join("\n")
      : ""
  ].filter(Boolean).join("\n\n");

  const execution = existingExecutionId
    ? await prisma.agentExecution.update({
        where: { id: existingExecutionId },
        data: { status: "RUNNING", cancelRequested: false, heartbeatAt: new Date(), error: null, finishedAt: null }
      })
    : await prisma.agentExecution.create({
        data: { projectId, conversationId, status: "RUNNING", prompt }
      });

  const shared: string[] = [];
  let toolCount = 0;
  let turns = 0;

  const roleRun = async (role: SpecialistRole, task: string) => {
    onEvent({ type: "specialist_start", role, name: SPECIALISTS[role].name });

    const sharedContext = [contextSummary, ...shared].filter(Boolean).join("\n\n").slice(-12000);
    const result = await runModelProvider(
      provider,
      model,
      specialistPrompt(role, task, sharedContext),
      effectiveHistory,
      TOOL_DEFINITIONS.map(tool => tool as any),
      event => {
        onEvent({ ...event, role });
        void prisma.executionEvent.create({
          data:{executionId:execution.id,type:String(event.type),data:JSON.stringify({...event,role}).slice(0,20000)}
        }).catch(()=>undefined);
      },
      specialistTurns,
      execution.id,
      role,
      projectId
    );

    toolCount += result.toolCount;
    turns += result.turns;
    shared.push(SPECIALISTS[role].name + ": " + result.text);
    onEvent({ type: "specialist_complete", role, name: SPECIALISTS[role].name });
    return result.text;
  };

  try {
    const plan = await roleRun("planner", prompt);
    const implementation = await roleRun("coder", prompt + "\nPlanner:\n" + plan);
    const review = await roleRun("reviewer", prompt + "\nImplementation:\n" + implementation);

    let debug = "";
    if (/fail|error|bug|regression|missing|incorrect|broken/i.test(review)) {
      debug = await roleRun("debugger", prompt + "\nReview findings:\n" + review + "\nRepair the project.");
    }

    const verification = await roleRun(
      "verifier",
      prompt + "\nReview:\n" + review +
      (debug ? "\nDebugger:\n" + debug : "") +
      "\nVerify the current project using available tools."
    );

    const final = [
      "Planner: " + plan,
      "Coder: " + implementation,
      "Reviewer: " + review,
      debug ? "Debugger: " + debug : "",
      "Verifier: " + verification
    ].filter(Boolean).join("\n\n");

    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: { status: "SUCCEEDED", result: final, toolCount, finishedAt: new Date() }
    });
    await upsertProjectMemory(projectId, "execution", "last-result", final.slice(-12000));

    return { text: final, toolCount, turns };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Specialist pipeline failed";
    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: {
        status: message === "Execution cancelled." ? "CANCELLED" : "FAILED",
        error: message,
        toolCount,
        finishedAt: new Date()
      }
    });
    throw error;
  }
}