import OpenAI from "openai";
import { executeTool } from "./tools";
import { registerExecution, unregisterExecution } from "./execution-control";
import { prisma } from "@/lib/prisma";
import { hasProviderKey, modelIdForLabel } from "./model-router";
import { LUMIA_CODING_INSTRUCTIONS } from "./policy";
import { LUMIA_CODING_INSTRUCTIONS } from "./policy";
export type ModelProvider = "anthropic"|"openai"|"google"|"xai"|"groq";

export type AgentEvent =
  | { type:"thinking"; detail:string }
  | { type:"tool_start"; tool:string; detail?:string }
  | { type:"tool_result"; tool:string; detail:string }
  | { type:"message"; text:string };

export type AgentRunResult = { text:string; toolCount:number; turns:number };

const instructions = LUMIA_CODING_INSTRUCTIONS + "\nYou are currently running in CODING AGENT mode.";

function openAICompatibleClient(provider: "openai"|"google"|"xai"|"groq") {
  if (provider === "openai") return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (provider === "google") return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultHeaders: { "x-goog-api-client": "lumia-ai-agent/1.0" }
  });
  if (provider === "xai") return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: process.env.XAI_BASE_URL || "https://api.x.ai/v1"
  });
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
  });
}

import type { ChatCompletionTool } from "openai/resources/chat/completions";

function normalizeChatTools(tools:any[]): ChatCompletionTool[] {
  return tools.map((t:any) => ({
    type: "function" as const,
    function: {
      name: String(t.function?.name || t.name),
      description: String(t.function?.description || t.description || ""),
      parameters: t.function?.parameters || t.parameters || { type: "object", properties: {} },
      ...(typeof (t.function?.strict ?? t.strict) === "boolean"
        ? { strict: Boolean(t.function?.strict ?? t.strict) }
        : {})
    }
  }));
}

function normalizeResponseTools(tools:any[]) {
  return tools.map((t:any) => ({
    type: "function" as const,
    name: String(t.function?.name || t.name),
    description: String(t.function?.description || t.description || ""),
    parameters: t.function?.parameters || t.parameters || { type: "object", properties: {} },
    strict: Boolean(t.function?.strict ?? t.strict ?? false)
  }));
}

async function runOpenAIResponses(
  model:string,
  input:string,
  history:{role:"user"|"assistant";content:string}[],
  tools:any[],
  onEvent:(e:AgentEvent)=>void,
  maxTurns:number,
  executionId?:string,
  projectId?:string
):Promise<AgentRunResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inputItems:any[] = [
    ...history.slice(-20).map(x => ({ role:x.role, content:x.content })),
    { role:"user", content:input }
  ];
  let cancelled=false, toolCount=0, turn=0;
  if(executionId) registerExecution(executionId,()=>{cancelled=true;});
  const heartbeat=executionId?setInterval(()=>{void prisma.agentExecution.updateMany({
    where:{id:executionId,status:{in:["RUNNING","CANCEL_REQUESTED"]}},data:{heartbeatAt:new Date()}
  });},5000):undefined;

  try {
    while(turn<maxTurns) {
      if(cancelled) return {text:"Execution cancelled by the user.",toolCount,turns:turn};
      onEvent({type:"thinking",detail:"Choosing the next coding step."});
      const response:any=await client.responses.create({
        model,
        instructions,
        input:inputItems,
        tools:normalizeResponseTools(tools),
        tool_choice:"auto"
      });

      const outputItems = response.output || [];
      const calls = outputItems.filter((item:any)=>item.type==="function_call");
      if(!calls.length) {
        const text=String(response.output_text || "Task completed.");
        onEvent({type:"message",text});
        return {text,toolCount,turns:turn};
      }

      // Responses API requires the original function_call items to remain
      // in the next input before their matching function_call_output items.
      inputItems.push(...outputItems);

      for(const call of calls) {
        toolCount++;
        const name=String(call.name || "");
        onEvent({type:"tool_start",tool:name,detail:"Executing project tool."});
        let output="";
        try {
          let rawArguments = String(call.arguments || "{}").trim();

          // Some providers can occasionally emit malformed/truncated JSON
          // for function arguments. Keep the failure inside the tool loop so
          // the model can see the error and retry instead of aborting Lumia.
          let args:any;
          try {
            args = JSON.parse(rawArguments);
          } catch(parseError) {
            const parseMessage = parseError instanceof Error ? parseError.message : "Invalid JSON";
            output = JSON.stringify({
              error: "Invalid tool arguments JSON.",
              parseError: parseMessage,
              arguments: rawArguments.slice(0, 4000)
            });
            onEvent({type:"tool_result",tool:name,detail:parseMessage});
            inputItems.push({
              type:"function_call_output",
              call_id:call.call_id,
              output
            });
            continue;
          }

          output=String(await executeTool(name,args,projectId || ""));
          onEvent({type:"tool_result",tool:name,detail:output.slice(0,4000)});
        } catch(error) {
          const messageText=error instanceof Error?error.message:"Tool failed";
          output=JSON.stringify({error:messageText});
          onEvent({type:"tool_result",tool:name,detail:messageText});
        }
        inputItems.push({
          type:"function_call_output",
          call_id:call.call_id,
          output
        });
      }
      turn++;
    }
    const text="Lumia stopped at the autonomous execution safety limit.";
    onEvent({type:"message",text});
    return {text,toolCount,turns:turn};
  } finally {
    if(heartbeat) clearInterval(heartbeat);
    if(executionId) unregisterExecution(executionId);
  }
}

async function runChatProvider(
  provider: "openai"|"google"|"xai"|"groq",
  model: string,
  input: string,
  history:{role:"user"|"assistant";content:string}[],
  tools:any[],
  onEvent:(e:AgentEvent)=>void,
  maxTurns:number,
  executionId?:string,
  projectId?:string
):Promise<AgentRunResult> {
  const client = openAICompatibleClient(provider);
  const messages:any[] = [
    { role:"system", content: instructions },
    ...history.slice(-20),
    { role:"user", content: input }
  ];
  let cancelled=false;
  if(executionId) registerExecution(executionId,()=>{cancelled=true;});
  const heartbeat=executionId?setInterval(()=>{void prisma.agentExecution.updateMany({
    where:{id:executionId,status:{in:["RUNNING","CANCEL_REQUESTED"]}},data:{heartbeatAt:new Date()}
  });},5000):undefined;

  try {
    let turn=0, toolCount=0;
    while(turn<maxTurns) {
      if(cancelled) return {text:"Execution cancelled by the user.",toolCount,turns:turn};
      onEvent({type:"thinking",detail:"Choosing the next coding step."});
      const response=await client.chat.completions.create({
        model,
        messages,
        tools:normalizeChatTools(tools),
        tool_choice:"auto"
      });
      const message:any=response.choices?.[0]?.message;
      const calls=message?.tool_calls || [];
      if(!calls.length) {
        const text=String(message?.content || "Task completed.");
        onEvent({type:"message",text});
        return {text,toolCount,turns:turn};
      }
      messages.push(message);
      for(const call of calls) {
        toolCount++;
        const name=call.function?.name || "";
        onEvent({type:"tool_start",tool:name,detail:"Executing project tool."});
        try {
          const args=JSON.parse(call.function?.arguments || "{}");
          const result=await executeTool(name,args,projectId || "");
          const output=String(result);
          onEvent({type:"tool_result",tool:name,detail:output.slice(0,4000)});
          messages.push({role:"tool",tool_call_id:call.id,content:output});
        } catch(error) {
          const messageText=error instanceof Error?error.message:"Tool failed";
          onEvent({type:"tool_result",tool:name,detail:messageText});
          messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify({error:messageText})});
        }
      }
      turn++;
    }
    const text="Lumia stopped at the autonomous execution safety limit.";
    onEvent({type:"message",text});
    return {text,toolCount,turns:turn};
  } finally {
    if(heartbeat) clearInterval(heartbeat);
    if(executionId) unregisterExecution(executionId);
  }
}

function anthropicTools(tools:any[]) {
  return tools.map((t:any)=>({
    name:t.name,
    description:t.description,
    input_schema:t.parameters || {type:"object",properties:{}}
  }));
}

async function runAnthropic(
  model:string,
  input:string,
  history:{role:"user"|"assistant";content:string}[],
  tools:any[],
  onEvent:(e:AgentEvent)=>void,
  maxTurns:number,
  executionId?:string,
  projectId?:string
):Promise<AgentRunResult> {
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  const messages:any[]=[...history.slice(-20).map(x=>({role:x.role,content:x.content})),{role:"user",content:input}];
  let cancelled=false,toolCount=0,turn=0;
  if(executionId) registerExecution(executionId,()=>{cancelled=true;});
  const heartbeat=executionId?setInterval(()=>{void prisma.agentExecution.updateMany({
    where:{id:executionId,status:{in:["RUNNING","CANCEL_REQUESTED"]}},data:{heartbeatAt:new Date()}
  });},5000):undefined;

  try {
    while(turn<maxTurns) {
      if(cancelled) return {text:"Execution cancelled by the user.",toolCount,turns:turn};
      onEvent({type:"thinking",detail:"Planning the next coding step."});
      const response=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model,
          max_tokens:Number(process.env.LUMIA_ANTHROPIC_MAX_TOKENS || 8192),
          system:instructions,
          messages,
          tools:anthropicTools(tools)
        })
      });
      const data:any=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error("Anthropic API error "+response.status+": "+(data?.error?.message || "Request failed"));
      const blocks=data.content || [];
      const text=blocks.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n").trim();
      const toolUses=blocks.filter((b:any)=>b.type==="tool_use");
      if(!toolUses.length) {
        const final=text || "Task completed.";
        onEvent({type:"message",text:final});
        return {text:final,toolCount,turns:turn};
      }
      messages.push({role:"assistant",content:blocks});
      const results:any[]=[];
      for(const use of toolUses) {
        toolCount++;
        onEvent({type:"tool_start",tool:use.name,detail:"Executing project tool."});
        try {
          const result=await executeTool(use.name,use.input || {},projectId || "");
          const output=String(result);
          onEvent({type:"tool_result",tool:use.name,detail:output.slice(0,4000)});
          results.push({type:"tool_result",tool_use_id:use.id,content:output});
        } catch(error) {
          const messageText=error instanceof Error?error.message:"Tool failed";
          onEvent({type:"tool_result",tool:use.name,detail:messageText});
          results.push({type:"tool_result",tool_use_id:use.id,content:JSON.stringify({error:messageText}),is_error:true});
        }
      }
      messages.push({role:"user",content:results});
      turn++;
    }
    const text="Lumia stopped at the autonomous execution safety limit.";
    onEvent({type:"message",text});
    return {text,toolCount,turns:turn};
  } finally {
    if(heartbeat) clearInterval(heartbeat);
    if(executionId) unregisterExecution(executionId);
  }
}

export async function runModelProvider(
  provider: ModelProvider,
  model:string|undefined,
  input:string,
  history:{role:"user"|"assistant";content:string}[],
  tools:any[],
  onEvent:(e:AgentEvent)=>void,
  maxTurns:number,
  executionId?:string,
  routingRole?:string,
  projectId?:string
):Promise<AgentRunResult> {
  const selectedProvider=provider;
  const selectedModel=modelIdForLabel(provider, model || process.env.OPENAI_MODEL || "gpt-5.5");

  if(selectedProvider==="openai") {
    if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured on the server.");
    return runOpenAIResponses(selectedModel,input,history,tools,onEvent,maxTurns,executionId,projectId);
  }

  if(selectedProvider==="anthropic")
    return runAnthropic(selectedModel,input,history,tools,onEvent,maxTurns,executionId,projectId);
  if(selectedProvider==="google" && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY)
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is not configured on the server.");
  if(selectedProvider==="xai" && !process.env.XAI_API_KEY)
    throw new Error("XAI_API_KEY is not configured on the server.");
  if(selectedProvider==="groq" && !process.env.GROQ_API_KEY)
    throw new Error("GROQ_API_KEY is not configured on the server.");

  return runChatProvider(selectedProvider,selectedModel,input,history,tools,onEvent,maxTurns,executionId,projectId);
}

export const openAIProvider = {
  run: (
    input:string,
    history:{role:"user"|"assistant";content:string}[],
    tools:any[],
    onEvent:(e:AgentEvent)=>void,
    maxTurns:number,
    executionId?:string,
    model?:string
  ) => runModelProvider("openai",model,input,history,tools,onEvent,maxTurns,executionId)
};
