import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runProjectCommand } from "@/lib/agent/command-runner";
import { NextResponse } from "next/server";

export const runtime="nodejs";

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const body=await req.json().catch(()=>({}));
  const command=String(body.command||"");
  const args=Array.isArray(body.args)?body.args.map(String):[];
  if(!command)return NextResponse.json({error:"command is required"},{status:400});
  const execution=await prisma.agentExecution.create({data:{projectId:id,status:"RUNNING",prompt:[command,...args].join(" ")}});
  try {
    const result=await runProjectCommand(id,command,args);
    const status=result.code===0&&!result.timedOut?"SUCCEEDED":"FAILED";
    await prisma.agentExecution.update({where:{id:execution.id},data:{status,result:JSON.stringify(result),finishedAt:new Date(),toolCount:1}});
    return NextResponse.json({executionId:execution.id,result});
  } catch(e) {
    const msg=e instanceof Error?e.message:"Execution failed";
    await prisma.agentExecution.update({where:{id:execution.id},data:{status:"FAILED",error:msg,finishedAt:new Date(),toolCount:1}});
    return NextResponse.json({executionId:execution.id,error:msg},{status:400});
  }
}