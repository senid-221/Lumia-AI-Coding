import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureProjectWorkspace } from "@/lib/agent/workspace";
import { NextResponse } from "next/server";
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const root=await ensureProjectWorkspace(id);
  return NextResponse.json({projectId:id,ready:true});
}