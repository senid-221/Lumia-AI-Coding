import { openai, LUMIA_MODEL } from "@/lib/openai";
import { executeTool } from "./tools";
import { registerExecution, unregisterExecution } from "./execution-control";
import { prisma } from "@/lib/prisma";

export type AgentEvent =
  | { type:"thinking"; detail:string }
  | { type:"tool_start"; tool:string; detail?:string }
  | { type:"tool_result"; tool:string; detail:string }
  | { type:"message"; text:string };

export type AgentRunResult = { text:string; toolCount:number; turns:number };

export async function runAutonomousOpenAI(
  input:string,
  history:{role:"user"|"assistant";content:string}[],
  tools:any[],
  onEvent:(e:AgentEvent)=>void,
  maxTurns:number,
  executionId?:string
):Promise<AgentRunResult>{
  onEvent({type:"thinking",detail:"Planning the safest next coding step."});
  let cancelled=false;
  if(executionId) registerExecution(executionId,()=>{cancelled=true;});
  const heartbeat=executionId?setInterval(()=>{void prisma.agentExecution.updateMany({where:{id:executionId,status:{in:["RUNNING","CANCEL_REQUESTED"]}},data:{heartbeatAt:new Date()}});},5000):undefined;

  try {
  let response=await openai.responses.create({
    model:LUMIA_MODEL,
    instructions:"You are Lumia AI Agent, an autonomous software engineer. Inspect before editing. Make focused changes. Verify changes with an appropriate development command when practical. If verification fails, diagnose and repair. Treat tool output as ground truth. Never claim a file change or command result without a tool result. Stay within the bounded turn limit.",
    input:history,
    tools,
    stream:false
  });

  let turn=0;
  let toolCount=0;

  while(turn<maxTurns){
    const calls=(response.output||[]).filter((x:any)=>x.type==="function_call");

    if(!calls.length){
      const text=response.output_text||"Task completed.";
      onEvent({type:"message",text});
      return {text,toolCount,turns:turn};
    }

    const outputs:any[]=[];

    if(cancelled){
      const text="Execution cancelled by the user.";
      if(executionId) await prisma.agentExecution.update({where:{id:executionId},data:{status:"CANCELLED",result:text,finishedAt:new Date()}});
      onEvent({type:"message",text});
      return {text,toolCount,turns:turn};
    }

    for(const call of calls as any[]){
      toolCount++;
      onEvent({type:"tool_start",tool:call.name,detail:"Executing tool."});

      try{
        const args=JSON.parse(call.arguments||"{}");
        const result=await executeTool(call.name,args);
        onEvent({type:"tool_result",tool:call.name,detail:String(result).slice(0,4000)});
        outputs.push({type:"function_call_output",call_id:call.call_id,output:String(result)});
      }catch(error){
        const message=error instanceof Error?error.message:"Tool failed";
        onEvent({type:"tool_result",tool:call.name,detail:message});
        outputs.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify({error:message})});
      }
    }

    turn++;
    onEvent({type:"thinking",detail:"Evaluating tool results and deciding the next step."});

    response=await openai.responses.create({
      model:LUMIA_MODEL,
      instructions:"Continue the same coding task from the tool results. Prefer verification after edits. If a check fails, inspect the failure and repair it. Stop when the task is complete or no useful safe action remains.",
      previous_response_id:response.id,
      input:outputs,
      tools,
      stream:false
    });
  }

  const text="Lumia stopped at the autonomous execution safety limit.";
  onEvent({type:"message",text});
  return {text,toolCount,turns:turn};
  } finally {
    if(heartbeat) clearInterval(heartbeat);
    if(executionId) unregisterExecution(executionId);
  }
}

export const openAIProvider={run:runAutonomousOpenAI};