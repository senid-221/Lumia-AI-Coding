import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createResumeExecution } from "@/lib/agent/resume";
import { NextResponse } from "next/server";

export async function POST(_req:Request,{params}:{params:Promise<{id:string;executionId:string}>}){
  const {id,executionId}=await params;
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id},select:{id:true}});
  if(!project)return NextResponse.json({error:"Project not found"},{status:404});
  try{
    const execution=await createResumeExecution(id,executionId);
    return NextResponse.json({execution});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to resume execution"},{status:400});
  }
}