import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);
  const executions = await prisma.agentExecution.findMany({
    where: { projectId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true, status: true, prompt: true, result: true, error: true, toolCount: true,
      startedAt: true, finishedAt: true, cancelRequested: true, heartbeatAt: true,
      parentExecutionId: true,
      _count: { select: { events: true, toolCalls: true } }
    }
  });
  return NextResponse.json({ executions });
}
