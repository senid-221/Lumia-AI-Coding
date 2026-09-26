import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runProjectCommand } from "@/lib/agent/command-runner";
import { NextResponse } from "next/server";

export const runtime="nodejs";
const allowed=new Set(["status","log","diff"]);

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const action=new URL(req.url).searchParams.get("action")||"status";
  if(!allowed.has(action))return NextResponse.json({error:"Unsupported git action"},{status:400});
  const args=action==="status"?["status","--short","--branch"]:action==="log"?["log","-10","--oneline"]:["diff","--stat"];
  try { return NextResponse.json({action,result:await runProjectCommand(id,"git",args)}); }
  catch(e){ return NextResponse.json({error:e instanceof Error?e.message:"Git failed"},{status:400}); }
}