import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const settings = await prisma.projectSettings.findUnique({ where: { projectId: id } });
  return NextResponse.json({ settings });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider.slice(0, 40) : null;
  const model = typeof body.model === "string" ? body.model.slice(0, 160) : null;
  const settings = typeof body.settings === "object" && body.settings ? JSON.stringify(body.settings) : null;
  const saved = await prisma.projectSettings.upsert({ where: { projectId: id }, update: { provider, model, settings }, create: { projectId: id, provider, model, settings } });
  await prisma.auditLog.create({ data: { userId: session.user.id, projectId: id, action: "project.settings.updated", resource: "projectSettings", resourceId: saved.id } });
  return NextResponse.json({ settings: saved });
}
