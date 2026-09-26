import { auth } from "@/auth";
import { getDefaultProvider, getProviderRegistry } from "@/lib/agent/provider-registry";
import { NextResponse } from "next/server";

export async function GET(){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({defaultProvider:getDefaultProvider(),providers:getProviderRegistry()});
}