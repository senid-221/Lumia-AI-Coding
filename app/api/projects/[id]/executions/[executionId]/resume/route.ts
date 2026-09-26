import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { enqueueAgentJob } from "@/lib/agent/durable-queue";

export const runtime="nodejs";

export async function POST(_req:Request,{params}:{params:Promise<{id:string;executionId:string}>}){
  const {id,executionId}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const source=await prisma.agentExecution.findFirst({
    where:{id:executionId,projectId:id,project:{userId:session.user.id}},
    select:{id:true,status:true,prompt:true,conversationId:true}
  });
  if(!source)return NextResponse.json({error:"Execution not found"},{status:404});
  if(!["CANCELLED","FAILED"].includes(source.status)){
    return NextResponse.json({error:"Only cancelled or failed executions can be resumed"},{status:400});
  }
  if(!source.conversationId) return NextResponse.json({error:"Execution has no conversation to resume."},{status:400});
  const execution=await prisma.agentExecution.create({
    data:{
      projectId:id,
      conversationId:source.conversationId,
      status:"QUEUED",
      prompt:source.prompt,
      parentExecutionId:source.id
    }
  });
  const queued=await enqueueAgentJob({executionId:execution.id,projectId:id,conversationId:source.conversationId,prompt:source.prompt});
  if(!queued){ await prisma.agentExecution.update({where:{id:execution.id},data:{status:"FAILED",error:"Durable queue is not configured."}}); return NextResponse.json({error:"Resume queue is not configured on the server."},{status:503}); }
  return NextResponse.json({execution,queued:true});
}