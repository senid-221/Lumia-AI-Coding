import { openai, LUMIA_MODEL } from "@/lib/openai";

export type AgentEvent =
  | { type:"tool_start"; tool:string }
  | { type:"tool_result"; tool:string; detail:string }
  | { type:"message"; text:string };

export interface AgentProvider {
  run(input:string, history:{role:"user"|"assistant";content:string}[], tools:any[], onEvent:(e:AgentEvent)=>void, maxTurns:number):Promise<string>;
}

export const openAIProvider:AgentProvider={
  async run(input,history,tools,onEvent,maxTurns){
    let response=await openai.responses.create({
      model:LUMIA_MODEL,
      instructions:"You are Lumia AI Agent. Inspect before editing. Make focused changes. After changes, run a relevant verification command. If verification fails, analyze the failure and fix it. Repeat only within the bounded turn limit. Never claim a file change or command result without tool confirmation.",
      input:[...history,{role:"user",content:input}],
      tools,
      stream:false
    });
    let turn=0;
    while(turn<maxTurns){
      const calls=(response.output||[]).filter((x:any)=>x.type==="function_call");
      if(!calls.length)return response.output_text||"Task completed.";
      const outputs:any[]=[];
      for(const call of calls as any[]){
        onEvent({type:"tool_start",tool:call.name});
        try{
          const args=JSON.parse(call.arguments||"{}");
          const mod=await import("./tools");
          const result=await mod.executeTool(call.name,args);
          onEvent({type:"tool_result",tool:call.name,detail:String(result).slice(0,3000)});
          outputs.push({type:"function_call_output",call_id:call.call_id,output:String(result)});
        }catch(e){
          const msg=e instanceof Error?e.message:"Tool failed";
          onEvent({type:"tool_result",tool:call.name,detail:msg});
          outputs.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify({error:msg})});
        }
      }
      response=await openai.responses.create({
        model:LUMIA_MODEL,
        instructions:"Continue the same coding task. Use tool results as ground truth. Prefer verifying after modifications; repair failures when practical, but stay within the execution limit.",
        previous_response_id:response.id,
        input:outputs,
        tools
      });
      turn++;
    }
    return "Lumia stopped at the autonomous execution safety limit.";
  }
};