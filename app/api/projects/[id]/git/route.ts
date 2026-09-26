import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runProjectCommand } from "@/lib/agent/command-runner";
import { NextResponse } from "next/server";
import { createProjectBranch, commitProjectChanges } from "@/lib/agent/git-workflow";

export const runtime="nodejs";
const allowed=new Set(["status","log","diff","diff-check","branch"]);

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const action=new URL(req.url).searchParams.get("action")||"status";
  if(!allowed.has(action))return NextResponse.json({error:"Unsupported git action"},{status:400});
  const args=
    action==="status"?["status","--short","--branch"]:
    action==="log"?["log","-10","--oneline"]:
    action==="diff-check"?["diff","--check"]:
    action==="branch"?["branch","--show-current"]:
    ["diff","--stat"];
  try { return NextResponse.json({action,result:await runProjectCommand(id,"git",args)}); }
  catch(e){ return NextResponse.json({error:e instanceof Error?e.message:"Git failed"},{status:400}); }
}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"");
  try{
    if(action==="branch"){
      const branch=String(body.branch||"").trim();
      return NextResponse.json({action,result:await createProjectBranch(id,branch)});
    }
    if(action==="commit"){
      if(body.confirm!==true)return NextResponse.json({error:"Explicit confirmation is required to commit changes"},{status:400});
      const message=String(body.message||"").trim();
      return NextResponse.json({action,result:await commitProjectChanges(id,message)});
    }
    return NextResponse.json({error:"Unsupported git mutation"},{status:400});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Git operation failed"},{status:400});
  }
}