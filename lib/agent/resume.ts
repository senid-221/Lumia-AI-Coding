import { prisma } from "@/lib/prisma";

export async function createResumeExecution(projectId:string, previousExecutionId:string){
  const previous=await prisma.agentExecution.findFirst({
    where:{id:previousExecutionId,projectId},
    select:{id: true,status:true,prompt:true,conversationId:true}
  });
  if(!previous) throw new Error("Execution not found");
  if(!["CANCELLED","FAILED"].includes(previous.status)) {
    throw new Error("Only cancelled or failed executions can be resumed");
  }
  const execution=await prisma.agentExecution.create({
    data:{
      projectId,
      conversationId:previous.conversationId,
      status:"RUNNING",
      prompt:"Resume: "+previous.prompt,
      parentExecutionId:previous.id
    }
  });
  return execution;
}