import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { markCancelRequested, requestExecutionCancel } from "@/lib/agent/execution-control";
import { NextResponse } from "next/server";

export async function POST(_req:Request,{params}:{params:Promise<{id:string;executionId:string}>}){
  const {id,executionId}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const execution=await prisma.agentExecution.findFirst({where:{id:executionId,projectId:id,project:{userId:session.user.id}}});
  if(!execution)return NextResponse.json({error:"Execution not found"},{status:404});
  if(!["RUNNING","CANCEL_REQUESTED"].includes(execution.status))return NextResponse.json({status:execution.status});
  await markCancelRequested(executionId);
  const active=requestExecutionCancel(executionId);
  return NextResponse.json({status:"CANCEL_REQUESTED",active});
}