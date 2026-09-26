import { prisma } from "@/lib/prisma";
import { openAIProvider, type AgentEvent } from "./provider";
import { TOOL_DEFINITIONS } from "./tools";

export async function runAutonomousCodingTask(
  userId:string, projectId:string, conversationId:string, prompt:string,
  history:{role:"user"|"assistant";content:string}[],
  onEvent:(event:AgentEvent)=>void
){
  const maxTurns=Number(process.env.LUMIA_AGENT_MAX_TURNS||12);
  await prisma.agentExecution.create({
    data:{projectId,conversationId,status:"RUNNING",prompt}
  }).catch(()=>null);

  let result="";
  try{
    result=await openAIProvider.run(
      prompt,
      history,
      TOOL_DEFINITIONS.map(t=>t as any),
      onEvent,
      maxTurns
    );
    onEvent({type:"message",text:result});
    return result;
  }catch(e){
    const msg=e instanceof Error?e.message:"Autonomous run failed";
    onEvent({type:"message",text:msg});
    throw e;
  }
}