import { prisma } from "@/lib/prisma";
import { openAIProvider, type AgentEvent } from "./provider";
import { TOOL_DEFINITIONS } from "./tools";

export async function runAutonomousCodingTask(
  projectId:string,
  conversationId:string,
  prompt:string,
  history:{role:"user"|"assistant";content:string}[],
  onEvent:(event:AgentEvent)=>void
){
  const maxTurns=Math.max(1,Math.min(Number(process.env.LUMIA_AGENT_MAX_TURNS||12),30));
  const execution=await prisma.agentExecution.create({
    data:{projectId,conversationId,status:"RUNNING",prompt}
  });

  try{
    const result=await openAIProvider.run(
      prompt,
      [...history,{role:"user",content:prompt}],
      TOOL_DEFINITIONS.map(tool=>tool as any),
      onEvent,
      maxTurns
    );

    await prisma.agentExecution.update({
      where:{id:execution.id},
      data:{
        status:"SUCCEEDED",
        result:result.text,
        toolCount:result.toolCount,
        finishedAt:new Date()
      }
    });

    return result;
  }catch(error){
    const message=error instanceof Error?error.message:"Autonomous run failed";

    await prisma.agentExecution.update({
      where:{id:execution.id},
      data:{
        status:"FAILED",
        error:message,
        finishedAt:new Date()
      }
    });

    throw error;
  }
}