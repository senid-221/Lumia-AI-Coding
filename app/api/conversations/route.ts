import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime="nodejs";

export async function GET(){
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});
  const conversations=await prisma.conversation.findMany({
    where:{userId:session.user.id},
    orderBy:{updatedAt:"desc"},
    take:50,
    select:{id:true,title:true,updatedAt:true,createdAt:true}
  });
  return NextResponse.json({conversations});
}