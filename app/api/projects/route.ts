import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const projects = await prisma.project.findMany({ where:{ userId:session.user.id }, orderBy:{ updatedAt:"desc" } });
  return NextResponse.json({ projects });
}
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const body = await req.json().catch(()=>({}));
  const name = String(body.name || "ai-agent").trim().slice(0,80);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50) || "ai-agent";
  const project = await prisma.project.upsert({
    where:{ userId_slug:{ userId:session.user.id, slug } },
    update:{},
    create:{ userId:session.user.id, name, slug }
  });
  return NextResponse.json({ project });
}