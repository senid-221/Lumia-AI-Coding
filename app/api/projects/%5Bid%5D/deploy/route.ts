import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runProjectCommand } from "@/lib/agent/command-runner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id }, select: { id: true, name: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Explicit confirmation is required before deployment preparation." }, { status: 400 });

  const execution = await prisma.agentExecution.create({ data: { projectId: id, status: "RUNNING", prompt: "Deployment preflight" } });
  try {
    const checks = [];
    for (const args of [["git", "status", "--short", "--branch"], ["npm", "run", "build"]]) {
      const command = args[0]!;
      const result = await runProjectCommand(id, command, args.slice(1));
      checks.push(result);
      if (result.code !== 0 || result.timedOut) {
        await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: "FAILED", result: JSON.stringify(checks), finishedAt: new Date() } });
        return NextResponse.json({ executionId: execution.id, ready: false, checks }, { status: 422 });
      }
    }
    await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: "SUCCEEDED", result: JSON.stringify(checks), finishedAt: new Date(), toolCount: checks.length } });
    await prisma.auditLog.create({ data: { userId: session.user.id, projectId: id, action: "deploy.preflight", resource: "project", resourceId: id } });
    return NextResponse.json({ executionId: execution.id, ready: true, checks, message: "Deployment preflight passed. Connect a deployment provider to publish the project." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deployment preflight failed";
    await prisma.agentExecution.update({ where: { id: execution.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    return NextResponse.json({ executionId: execution.id, ready: false, error: message }, { status: 400 });
  }
}
