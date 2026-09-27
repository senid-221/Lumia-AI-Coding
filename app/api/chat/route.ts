import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runAutonomousCodingTask, type ProviderId } from "@/lib/agent/orchestrator";
import { isSimpleConversation, runConversationalProvider } from "@/lib/agent/conversation";
import { classifyRequest, type LumiaAgent } from "@/lib/agent/policy";
import { rememberExplicitUserContext } from "@/lib/agent/memory";
import { NextResponse } from "next/server";
import { detectLanguage, languageInstruction } from "@/lib/agent/language-detector";

export const runtime = "nodejs";

const sse=(data:unknown)=>"data: "+JSON.stringify(data)+"\n\n";

function normalizeAgent(value:unknown):LumiaAgent {
  const v=String(value||"ai-agent").toLowerCase();
  const allowed: LumiaAgent[] = ["ai-agent","hacking-lab","planner","coder","reviewer","debugger","verifier","researcher","security-reviewer","ui-specialist","database-specialist"];
  return allowed.includes(v as LumiaAgent) ? v as LumiaAgent : "ai-agent";
}

function normalizeProvider(value:unknown):ProviderId {
  const v=String(value||"openai").toLowerCase().replace(/[^a-z]/g,"");
  if(v==="anthropic"||v==="claude") return "anthropic";
  if(v==="google"||v==="gemini") return "google";
  if(v==="xai"||v==="grok") return "xai";
  if(v==="groq") return "groq";
  return "openai";
}

export async function GET(req:Request){
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});
  const requestedId=new URL(req.url).searchParams.get("conversationId");
  const conversation=await prisma.conversation.findFirst({
    where:{userId:session.user.id,...(requestedId?{id:requestedId}: {})},
    orderBy:{updatedAt:"desc"},
    include:{messages:{orderBy:{createdAt:"asc"},take:100,select:{id:true,role:true,content:true,createdAt:true}}}
  });
  if(!conversation) return NextResponse.json({conversation:null,messages:[]});
  return NextResponse.json({
    conversation:{id:conversation.id,title:conversation.title,createdAt:conversation.createdAt,updatedAt:conversation.updatedAt},
    messages:conversation.messages.map(message=>({id:message.id,role:message.role==="USER"?"user":"assistant",content:message.content}))
  });
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
  const requestedProjectId=body.projectId?String(body.projectId):undefined;
  if(!task) return NextResponse.json({error:"Task is required"},{status:400});
  const detectedLanguage=detectLanguage(task);

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

  const project=requestedProjectId
    ? await prisma.project.findFirst({where:{id:requestedProjectId,userId:session.user.id}})
    : await prisma.project.upsert({
        where:{userId_slug:{userId:session.user.id,slug:"ai-agent"}},
        update:{updatedAt:new Date()},
        create:{userId:session.user.id,name:"AI Agent",slug:"ai-agent"}
      });
  if (!project) return NextResponse.json({error:"Selected project was not found or is not owned by this account."},{status:404});

  let conversation=conversationId
    ? await prisma.conversation.findFirst({where:{id:conversationId,userId:session.user.id,projectId:project.id}})
    : null;
  if(!conversation)
    conversation=await prisma.conversation.create({data:{userId:session.user.id,projectId:project.id,title:task.slice(0,80)}});

  await prisma.message.create({data:{conversationId:conversation.id,role:"USER",content:task}});
  await prisma.conversation.update({where:{id:conversation.id},data:{updatedAt:new Date()}});
  await rememberExplicitUserContext(session.user.id, task);
  if(detectedLanguage.code!=="unknown" && detectedLanguage.confidence>=0.55){
    await prisma.userMemory.upsert({where:{userId_key:{userId:session.user.id,key:"preferred-language"}},create:{userId:session.user.id,kind:"language",key:"preferred-language",content:detectedLanguage.code,confidence:detectedLanguage.confidence},update:{kind:"language",content:detectedLanguage.code,confidence:detectedLanguage.confidence}});
  }
  const storedHistory=await prisma.message.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:"asc"},take:30});
  const history=storedHistory.map(m=>({role:m.role==="USER"?"user" as const:"assistant" as const,content:m.content}));
  const userMemories=await prisma.userMemory.findMany({where:{userId:session.user.id},orderBy:{updatedAt:"desc"},take:30,select:{kind:true,key:true,content:true}});
  const memoryContext=userMemories.map(m=>`[${m.kind}] ${m.key}: ${m.content}`).join("\n");

  const stream=new ReadableStream({
    async start(controller){
      const encoder=new TextEncoder();
      const send=(data:unknown)=>controller.enqueue(encoder.encode(sse(data)));
      send({type:"conversation",id:conversation!.id});
      send({type:"provider",provider,model:requestedModel||undefined});
      send({type:"language",code:detectedLanguage.code,name:detectedLanguage.name,confidence:detectedLanguage.confidence,mixed:detectedLanguage.mixed});

      try{
        const mode=classifyRequest(task,agent);
        send({type:"mode",mode,agent});
        if(mode==="conversation"){
          const result=await runConversationalProvider(
            provider,
            requestedModel||undefined,
            task,
            history,
            memoryContext,
            event=>send(event)
          );
          await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:result.text}});
          await prisma.conversation.update({where:{id:conversation!.id},data:{updatedAt:new Date()}});
          send({type:"message",text:result.text});
          send({type:"complete",toolCount:0,turns:0});
          return;
        }


        const languagePrompt=languageInstruction(detectedLanguage);
        const labPrompt=agent==="hacking-lab" ? "You are Lumia Hacking Lab Agent. Educational / Authorized Lab Only. Focus on defensive security, CTFs, simulations, secure code review, vulnerability explanations, and authorized lab targets. Never perform or instruct account takeover, credential theft, OTP interception, SIM swapping, malware deployment, persistence, evasion, destructive actions, or unauthorized access. Task:\n"+task : task;
        const codingPrompt=labPrompt+"\n\nSelected agent: "+agent+"\n\nLanguage behavior:\n"+languagePrompt;
        const result=await runAutonomousCodingTask(
          project.id,
          conversation!.id,
          codingPrompt,
          history,
          event=>send(event),
          undefined,
          provider,
          requestedModel||undefined
        );
        await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:result.text}});
        await prisma.conversation.update({where:{id:conversation!.id},data:{updatedAt:new Date()}});
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
