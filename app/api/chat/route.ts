import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runAutonomousCodingTask, type ProviderId } from "@/lib/agent/orchestrator";
import { isSimpleConversation, runConversationalProvider } from "@/lib/agent/conversation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const sse=(data:unknown)=>"data: "+JSON.stringify(data)+"\n\n";

function normalizeAgent(value:unknown) { return String(value||"ai-agent").toLowerCase()==="hacking-lab" ? "hacking-lab" : "ai-agent"; }

function normalizeProvider(value:unknown):ProviderId {
  const v=String(value||"openai").toLowerCase().replace(/[^a-z]/g,"");
  if(v==="anthropic"||v==="claude") return "anthropic";
  if(v==="google"||v==="gemini") return "google";
  if(v==="xai"||v==="grok") return "xai";
  if(v==="groq") return "groq";
  return "openai";
}

export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});

  const body=await req.json().catch(()=>({}));
  const task=String(body.task||"").trim();
  const conversationId=body.conversationId?String(body.conversationId):undefined;
  const agent=normalizeAgent(body.agent);
  const provider=normalizeProvider(body.provider);
  const requestedModel=String(body.model||"").trim();
  if(!task) return NextResponse.json({error:"Task is required"},{status:400});

  if(agent==="hacking-lab" && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.XAI_API_KEY && !process.env.GROQ_API_KEY)
    return NextResponse.json({error:"Hacking Lab requires a configured AI provider."},{status:500});
  if(provider==="openai" && !process.env.OPENAI_API_KEY)
    return NextResponse.json({error:"OPENAI_API_KEY is not configured on the server."},{status:500});
  if(provider==="anthropic" && !process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({error:"ANTHROPIC_API_KEY is not configured on the server."},{status:500});
  if(provider==="google" && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY)
    return NextResponse.json({error:"GEMINI_API_KEY or GOOGLE_API_KEY is not configured on the server."},{status:500});
  if(provider==="xai" && !process.env.XAI_API_KEY)
    return NextResponse.json({error:"XAI_API_KEY is not configured on the server."},{status:500});
  if(provider==="groq" && !process.env.GROQ_API_KEY)
    return NextResponse.json({error:"GROQ_API_KEY is not configured on the server."},{status:500});

  const project=await prisma.project.upsert({
    where:{userId_slug:{userId:session.user.id,slug:"ai-agent"}},
    update:{updatedAt:new Date()},
    create:{userId:session.user.id,name:"AI Agent",slug:"ai-agent"}
  });

  let conversation=conversationId
    ? await prisma.conversation.findFirst({where:{id:conversationId,userId:session.user.id,projectId:project.id}})
    : null;
  if(!conversation)
    conversation=await prisma.conversation.create({data:{userId:session.user.id,projectId:project.id,title:task.slice(0,80)}});

  await prisma.message.create({data:{conversationId:conversation.id,role:"USER",content:task}});
  const storedHistory=await prisma.message.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:"asc"},take:30});
  const history=storedHistory.map(m=>({role:m.role==="USER"?"user" as const:"assistant" as const,content:m.content}));

  const stream=new ReadableStream({
    async start(controller){
      const encoder=new TextEncoder();
      const send=(data:unknown)=>controller.enqueue(encoder.encode(sse(data)));
      send({type:"conversation",id:conversation!.id});
      send({type:"provider",provider,model:requestedModel||undefined});

      try{
        if(agent==="ai-agent" && isSimpleConversation(task)){
          const result=await runConversationalProvider(provider,requestedModel||undefined,task,history);
          await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:result.text}});
          send({type:"message",text:result.text});
          send({type:"complete",toolCount:0,turns:0});
          return;
        }


        const labPrompt=agent==="hacking-lab" ? "You are Lumia Hacking Lab Agent. Educational / Authorized Lab Only. Focus on defensive security, CTFs, simulations, secure code review, vulnerability explanations, and authorized lab targets. Never perform or instruct account takeover, credential theft, OTP interception, SIM swapping, malware deployment, persistence, evasion, destructive actions, or unauthorized access. Task:\n"+task : task;
        const result=await runAutonomousCodingTask(
          project.id,
          conversation!.id,
          labPrompt,
          history,
          event=>send(event),
          undefined,
          provider,
          requestedModel||undefined
        );
        await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:result.text}});
        send({type:"complete",toolCount:result.toolCount,turns:result.turns});
      }catch(error){
        send({type:"error",error:error instanceof Error?error.message:"Agent execution failed"});
      }finally{
        send("[DONE]");
        controller.close();
      }
    }
  });

  return new Response(stream,{headers:{
    "content-type":"text/event-stream; charset=utf-8",
    "cache-control":"no-cache, no-transform",
    "connection":"keep-alive"
  }});
}
