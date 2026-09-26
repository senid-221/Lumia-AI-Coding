import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  const execution=await prisma.agentExecution.create({
    data:{
      projectId:id,
      conversationId:source.conversationId,
      status:"QUEUED",
      prompt:source.prompt,
      parentExecutionId:source.id
    }
  });
  return NextResponse.json({execution});
}