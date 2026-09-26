import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function owned(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { session: null, project: null };
  const project = await prisma.project.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  return { session, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await owned(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const integrations = await prisma.integration.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, provider: true, name: true, status: true, createdAt: true, updatedAt: true } });
  const gitRepositories = await prisma.gitRepository.findMany({ where: { projectId: id }, orderBy: { updatedAt: "desc" }, select: { id: true, provider: true, owner: true, name: true, url: true, defaultBranch: true, updatedAt: true } });
  return NextResponse.json({ integrations, gitRepositories });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await owned(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider || "").trim().toLowerCase();
  const name = String(body.name || provider || "Connector").trim().slice(0, 80);
  if (!["github", "google"].includes(provider)) return NextResponse.json({ error: "Supported connectors: GitHub, Google" }, { status: 400 });
  const integration = await prisma.integration.create({ data: { userId: session.user.id, provider, name, status: "configured", config: JSON.stringify({ configuredBy: "workspace" }) } });
  await prisma.auditLog.create({ data: { userId: session.user.id, projectId: id, action: "integration.created", resource: "integration", resourceId: integration.id, metadata: JSON.stringify({ provider }) } });
  return NextResponse.json({ integration });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await owned(id);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const integrationId = String(new URL(req.url).searchParams.get("integrationId") || "");
  if (!integrationId) return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, userId: session.user.id } });
  if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  await prisma.integration.delete({ where: { id: integrationId } });
  await prisma.auditLog.create({ data: { userId: session.user.id, projectId: id, action: "integration.deleted", resource: "integration", resourceId: integrationId } });
  return NextResponse.json({ deleted: true });
}
