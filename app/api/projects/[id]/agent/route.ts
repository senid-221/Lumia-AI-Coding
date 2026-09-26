import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runAutonomousCodingTask } from "@/lib/agent/orchestrator";
import { NextResponse } from "next/server";

export const runtime="nodejs";

const sse=(d:unknown)=>"data: "+JSON.stringify(d)+"\\n\\n";

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const session=await auth();
 if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
 const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
 if(!project)return NextResponse.json({error:"Project not found"},{status:404});
 const body=await req.json().catch(()=>({})); const prompt=String(body.prompt||"").trim();
 if(!prompt)return NextResponse.json({error:"prompt is required"},{status:400});
 const conversation=await prisma.conversation.create({data:{userId:session.user.id,projectId:id,title:prompt.slice(0,80)}});
 const encoder=new TextEncoder();
 const stream=new ReadableStream({
  async start(controller){
   const send=(x:unknown)=>controller.enqueue(encoder.encode(sse(x)));
   send({type:"conversation",id:conversation.id});
   try{
    const answer=await runAutonomousCodingTask(session.user.id,id,conversation.id,prompt,[],e=>send(e));
    await prisma.message.create({data:{conversationId:conversation.id,role:"ASSISTANT",content:answer}});
    send({type:"complete"});
   }catch(e){send({type:"error",error:e instanceof Error?e.message:"Agent failed"});}
   send("[DONE]"); controller.close();
  }
 });
 return new Response(stream,{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache"}});
}