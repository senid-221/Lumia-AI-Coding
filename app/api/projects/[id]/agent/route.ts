import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runAutonomousCodingTask } from "@/lib/agent/orchestrator";
import { NextResponse } from "next/server";

export const runtime="nodejs";
const sse=(data:unknown)=>"data: "+JSON.stringify(data)+"\n\n";

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const session=await auth();

  if(!session?.user?.id)
    return NextResponse.json({error:"Unauthorized"},{status:401});

  const project=await prisma.project.findFirst({
    where:{id,userId:session.user.id}
  });

  if(!project)
    return NextResponse.json({error:"Project not found"},{status:404});

  const body=await req.json().catch(()=>({}));
  const prompt=String(body.prompt||"").trim();

  if(!prompt)
    return NextResponse.json({error:"prompt is required"},{status:400});

  if(!process.env.OPENAI_API_KEY)
    return NextResponse.json({error:"OPENAI_API_KEY is not configured"},{status:500});

  const conversation=await prisma.conversation.create({
    data:{
      userId:session.user.id,
      projectId:id,
      title:prompt.slice(0,80)
    }
  });

  await prisma.message.create({
    data:{conversationId:conversation.id,role:"USER",content:prompt}
  });

  const encoder=new TextEncoder();

  const stream=new ReadableStream({
    async start(controller){
      const send=(data:unknown)=>
        controller.enqueue(encoder.encode(sse(data)));

      send({type:"conversation",id:conversation.id});

      try{
        const result=await runAutonomousCodingTask(
          id,
          conversation.id,
          prompt,
          [],
          event=>send(event)
        );

        await prisma.message.create({
          data:{
            conversationId:conversation.id,
            role:"ASSISTANT",
            content:result.text
          }
        });

        send({
          type:"complete",
          toolCount:result.toolCount,
          turns:result.turns
        });
      }catch(error){
        send({
          type:"error",
          error:error instanceof Error?error.message:"Agent execution failed"
        });
      }finally{
        send("[DONE]");
        controller.close();
      }
    }
  });

  return new Response(stream,{
    headers:{
      "content-type":"text/event-stream; charset=utf-8",
      "cache-control":"no-cache, no-transform",
      "connection":"keep-alive"
    }
  });
}