import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/agent/memory";
import { NextResponse } from "next/server";

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id},select:{id:true}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const url=new URL(req.url);
  const conversationId=url.searchParams.get("conversationId")||undefined;
  return NextResponse.json(await getProjectContext(id,conversationId));
}