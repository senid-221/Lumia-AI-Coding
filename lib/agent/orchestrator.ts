import { prisma } from "@/lib/prisma";
import { getProjectContext, upsertProjectMemory, rememberExplicitUserContext } from "./memory";
import { runModelProvider } from "./provider";
import type { ModelProvider } from "./model-router";
import { TOOL_DEFINITIONS } from "./tools";
import { SPECIALISTS, specialistPrompt, type SpecialistRole } from "./specialists";
import { loadProjectRules } from "./rule-loader";
import { getProjectContextSnapshot, formatProjectContext } from "./project-context";
import { detectLanguage, languageInstruction } from "./language-detector";

type ContextMessage = { role: "user" | "assistant"; content: string };
export type ProviderId = ModelProvider;

export async function runAutonomousCodingTask(
  projectId: string, conversationId: string, prompt: string, history: ContextMessage[],
  onEvent: (event: any) => void, existingExecutionId?: string,
  provider: ProviderId = "openai", model?: string, selectedRole?: SpecialistRole
) {
  const specialistTurns = Math.max(1, Math.min(Number(process.env.LUMIA_SPECIALIST_TURNS || 4), 8));
  const detectedLanguage = detectLanguage(prompt);
  const languageRule = languageInstruction(detectedLanguage);
  const projectContext = await getProjectContext(projectId, conversationId);
  onEvent({ type: "project_context_start" });
  const inspectedContext = await getProjectContextSnapshot(projectId);
  onEvent({ type: "project_context_complete", context: inspectedContext });
  if (projectContext.project?.userId) await rememberExplicitUserContext(projectContext.project.userId, prompt);
  const effectiveHistory = projectContext.history.length ? projectContext.history : history;
  const contextSummary = [
    projectContext.project ? `Project: ${projectContext.project.name} (${projectContext.project.slug})` : "",
    formatProjectContext(inspectedContext),
    "Language behavior: " + languageRule,
    projectContext.memories.length ? "Project memory:\n" + projectContext.memories.map(m => `[${m.kind}] ${m.key}: ${m.content}`).join("\n") : "",
    projectContext.userMemories?.length ? "User memory:\n" + projectContext.userMemories.map(m => `[${m.kind}] ${m.key}: ${m.content}`).join("\n") : "",
    projectContext.executions.length ? "Recent executions:\n" + projectContext.executions.map(e => `[${e.status}] ${e.prompt.slice(0, 240)}${e.error ? ` -> ${e.error}` : ""}`).join("\n") : ""
  ].filter(Boolean).join("\n\n");

  const execution = existingExecutionId
    ? await prisma.agentExecution.update({ where: { id: existingExecutionId }, data: { status: "RUNNING", cancelRequested: false, heartbeatAt: new Date(), error: null, finishedAt: null } })
    : await prisma.agentExecution.create({ data: { projectId, conversationId, status: "RUNNING", prompt } });

  const shared: string[] = [];
  let toolCount = 0, turns = 0;

  const roleRun = async (role: SpecialistRole, task: string) => {
    onEvent({ type: "specialist_start", role, name: SPECIALISTS[role].name });
    const sharedContext = [contextSummary, ...shared].filter(Boolean).join("\n\n").slice(-12000);
    const projectRules = await loadProjectRules(projectId, role);
    const result = await runModelProvider(
      provider, model, specialistPrompt(role, task, sharedContext, projectRules), effectiveHistory,
      TOOL_DEFINITIONS.map(tool => tool as any),
      event => {
        onEvent({ ...event, role });
        void prisma.executionEvent.create({ data:{executionId:execution.id,type:String(event.type),data:JSON.stringify({...event,role}).slice(0,20000)} }).catch(()=>undefined);
      },
      specialistTurns, execution.id, role, projectId
    );
    toolCount += result.toolCount;
    turns += result.turns;
    shared.push(SPECIALISTS[role].name + ": " + result.text);
    onEvent({ type: "specialist_complete", role, name: SPECIALISTS[role].name });
    return result.text;
  };

  try {
    const researchLike = /\\b(research|latest|current|documentation|docs|official|compare|verify|source|api reference)\\b/i.test(prompt);
    const securityLike = /\\b(security|auth|authentication|authorization|permission|secret|token|vulnerability|secure)\\b/i.test(prompt);
    const uiLike = /\\b(ui|ux|frontend|component|responsive|design|layout|css|tailwind)\\b/i.test(prompt);
    const databaseLike = /\\b(database|db|schema|migration|prisma|sql|query|table|relation)\\b/i.test(prompt);

    if (selectedRole) {
      const selectedResult = await roleRun(selectedRole, prompt);
      let selectedVerification = selectedResult;

      if (selectedRole !== "verifier") {
        selectedVerification = await roleRun(
          "verifier",
          prompt + "\nSelected specialist result:\n" + selectedResult +
          "\nVerify the current project using available tools. Run at least one objective verification command when the project supports it. Report the command and its actual result. End with exactly one status line: VERIFICATION_STATUS: PASS or VERIFICATION_STATUS: FAIL."
        );
      }

      const statusMatch = selectedVerification.match(/VERIFICATION_STATUS:\s*(PASS|FAIL)\b/i);
      const selectedVerificationPassed = statusMatch?.[1]?.toUpperCase() === "PASS";
      const resultStatus = selectedVerificationPassed ? "SUCCEEDED" : "FAILED";
      const final = [
        "Step 1: Selected specialist (" + selectedRole + ")\n" + selectedResult,
        "Step 2: Verify\n" + selectedVerification,
        selectedVerificationPassed ? "Result: Verification passed based on explicit evidence." : "Result: Verification did not pass. Lumia will not report this task as completed."
      ].join("\n\n");
      await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: resultStatus, result: final, toolCount, finishedAt: new Date() } });
      await upsertProjectMemory(projectId, "execution", "last-result", final.slice(-12000));
      return { text: final, toolCount, turns };
    }

    const plan = await roleRun("planner", prompt);
    if (researchLike) {
      await roleRun("researcher", prompt + "\\nPlanner:\\n" + plan + "\\nResearch the relevant current documentation or sources and return evidence.");
    }
    if (securityLike) {
      await roleRun("security-reviewer", prompt + "\\nPlanner:\\n" + plan + "\\nReview the security implications and required safeguards.");
    }
    if (uiLike) {
      await roleRun("ui-specialist", prompt + "\\nPlanner:\\n" + plan + "\\nInspect and address the UI/UX requirements.");
    }
    if (databaseLike) {
      await roleRun("database-specialist", prompt + "\\nPlanner:\\n" + plan + "\\nInspect the database requirements, schema, migrations, and data safety.");
    }
    const implementation = await roleRun("coder", prompt + "\\nPlanner:\\n" + plan);
    const review = await roleRun("reviewer", prompt + "\\nImplementation:\\n" + implementation);

    const maxRepairPasses = Math.max(0, Math.min(Number(process.env.LUMIA_REPAIR_PASSES || 2), 3));
    let verification = "";
    let debugResult = "";
    let repairPasses = 0;
    let verificationPassed = false;

    while (true) {
      verification = await roleRun(
        "verifier",
        prompt + "\nReview:\n" + review +
        (debugResult ? "\nDebugger:\n" + debugResult : "") +
        (repairPasses ? "\nRepair pass " + repairPasses + " was applied. Verify the repaired project again." : "") +
        "\nVerify the current project using available tools. Run at least one objective verification command when the project supports it. Report the command and its actual result. End with exactly one status line: VERIFICATION_STATUS: PASS or VERIFICATION_STATUS: FAIL."
      );

      const statusMatch = verification.match(/VERIFICATION_STATUS:\s*(PASS|FAIL)\b/i);
      verificationPassed = statusMatch?.[1]?.toUpperCase() === "PASS";
      if (verificationPassed) break;
      if (repairPasses >= maxRepairPasses) break;

      repairPasses++;
      debugResult = await roleRun(
        "debugger",
        prompt + "\nVerifier evidence:\n" + verification +
        "\nRepair pass " + repairPasses +
        ": inspect the actual failure, make the smallest safe repair, and do not claim success until the next verifier pass confirms it."
      );
    }

    const resultStatus = verificationPassed ? "SUCCEEDED" : "FAILED";
    const final = [
      "Step 1: Understand and plan\n" + plan,
      "Step 2: Work on the project\n" + implementation,
      "Step 3: Review\n" + review,
      debugResult ? "Step 4: Repair\n" + debugResult : "",
      "Step " + (debugResult ? "5" : "4") + ": Verify\n" + verification,
      verificationPassed ? "Result: Verification passed based on explicit verifier evidence." : "Result: Verification did not pass. Lumia will not report this task as completed."
    ].filter(Boolean).join("\n\n");

    await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: resultStatus, result: final, toolCount, finishedAt: new Date() } });
    await upsertProjectMemory(projectId, "execution", "last-result", final.slice(-12000));
    return { text: final, toolCount, turns };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Specialist pipeline failed";
    await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: message === "Execution cancelled." ? "CANCELLED" : "FAILED", error: message, toolCount, finishedAt: new Date() } });
    throw error;
  }
}