import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req:Request,{params}:{params:Promise<{id:string;executionId:string}>}){
  const {id,executionId}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id},select:{id:true}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const execution=await prisma.agentExecution.findFirst({where:{id:executionId,projectId:id}});
  if(!execution)return NextResponse.json({error:"Execution not found"},{status:404});
  return NextResponse.json(execution);
}