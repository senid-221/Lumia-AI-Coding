import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runAutonomousCodingTask, type ProviderId } from "@/lib/agent/orchestrator";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const sse=(data:unknown)=>"data: "+JSON.stringify(data)+"\n\n";

function normalizeProvider(value:unknown):ProviderId {
  return String(value||"openai").toLowerCase()==="zencode" ? "zencode" : "openai";
}

export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});

  const body=await req.json().catch(()=>({}));
  const task=String(body.task||"").trim();
  const conversationId=body.conversationId?String(body.conversationId):undefined;
  const provider=normalizeProvider(body.provider);
  const requestedModel=String(body.model||"").trim();
  if(!task) return NextResponse.json({error:"Task is required"},{status:400});

  if(provider==="zencode" && !process.env.ZENCODE_API_KEY)
    return NextResponse.json({error:"Zencoder API key is not configured on the server."},{status:500});
  if(provider==="openai" && !process.env.OPENAI_API_KEY)
    return NextResponse.json({error:"OPENAI_API_KEY is not configured on the server."},{status:500});

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
        const result=await runAutonomousCodingTask(
          project.id,
          conversation!.id,
          task,
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