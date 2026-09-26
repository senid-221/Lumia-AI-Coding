import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function getOwnedProject(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { session: null, project: null };
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id } });
  return { session, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await getOwnedProject(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await getOwnedProject(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  if (name !== undefined && !name) return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
  const updated = await prisma.project.update({ where: { id }, data: { ...(name ? { name } : {}) } });
  await prisma.auditLog.create({ data: { userId: session.user.id, projectId: id, action: "project.updated", resource: "project", resourceId: id, metadata: JSON.stringify({ fields: name ? ["name"] : [] }) } });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await getOwnedProject(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  await prisma.project.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: session.user.id, action: "project.deleted", resource: "project", resourceId: id } }).catch(() => undefined);
  return NextResponse.json({ deleted: true });
}
