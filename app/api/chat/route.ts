import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { openai, LUMIA_MODEL } from "@/lib/openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function sse(data: unknown) { return "data: " + JSON.stringify(data) + "\n\n"; }

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" },{status:401});
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error:"OPENAI_API_KEY is not configured" },{status:500});
  const body = await req.json().catch(()=>({}));
  const task = String(body.task || "").trim();
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;
  if (!task) return NextResponse.json({error:"Task is required"},{status:400});

  const project = await prisma.project.upsert({
    where:{userId_slug:{userId:session.user.id,slug:"ai-agent"}},
    update:{updatedAt:new Date()},
    create:{userId:session.user.id,name:"AI Agent",slug:"ai-agent"}
  });
  let conversation = conversationId ? await prisma.conversation.findFirst({where:{id:conversationId,userId:session.user.id}}) : null;
  if (!conversation) conversation = await prisma.conversation.create({data:{userId:session.user.id,projectId:project.id,title:task.slice(0,80)}});
  await prisma.message.create({data:{conversationId:conversation.id,role:"USER",content:task}});
  const history = await prisma.message.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:"asc"},take:30});

  const stream = await openai.responses.create({
    model:LUMIA_MODEL,
    instructions:"You are Lumia AI Agent, a professional software engineering assistant. Be practical, precise, and transparent about what you actually did. In this phase, do not claim to have edited files or run commands unless tools are explicitly provided.",
    input:history.map(m=>({role:m.role==="USER"?"user":"assistant",content:m.content})),
    stream:true
  });

  let assistant = "";
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sse({type:"conversation",id:conversation!.id})));
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") { assistant += event.delta; controller.enqueue(encoder.encode(sse({type:"delta",text:event.delta}))); }
        }
        await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:assistant}});
        controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close();
      } catch(e) {
        await prisma.message.create({data:{conversationId:conversation!.id,role:"ASSISTANT",content:assistant || "AI response failed."}}).catch(()=>{});
        controller.enqueue(encoder.encode(sse({type:"error",error:e instanceof Error?e.message:"AI response failed"}))); controller.close();
      }
    }
  });
  return new Response(readable,{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache, no-transform","connection":"keep-alive"}});
}