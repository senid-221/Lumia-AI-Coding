import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

type Provider = "anthropic"|"openai"|"google"|"xai"|"groq";

async function fetchJson(url:string,headers:Record<string,string>={}) {
  const res=await fetch(url,{headers,cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(String(data?.error?.message || data?.error || "Provider request failed"));
  return data;
}

export async function GET() {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});

  const providers:Record<Provider,{id:string;label:string;models:{id:string;label:string}[]}> = {
    anthropic:{id:"anthropic",label:"Anthropic",models:[]},
    openai:{id:"openai",label:"OpenAI",models:[]},
    google:{id:"google",label:"Google",models:[]},
    xai:{id:"xai",label:"xAI",models:[]},
    groq:{id:"groq",label:"Groq",models:[]}
  };

  const tasks:Promise<void>[]=[];

  if(process.env.ANTHROPIC_API_KEY) tasks.push((async()=>{try{
    const d=await fetchJson("https://api.anthropic.com/v1/models",{"x-api-key":process.env.ANTHROPIC_API_KEY!,"anthropic-version":"2023-06-01"});
    providers.anthropic.models=(d.data||[]).map((m:any)=>({id:m.id,label:m.display_name||m.id}));
  }catch{}})());

  if(process.env.OPENAI_API_KEY) tasks.push((async()=>{try{
    const d=await fetchJson("https://api.openai.com/v1/models",{Authorization:"Bearer "+process.env.OPENAI_API_KEY!});
    providers.openai.models=(d.data||[]).map((m:any)=>({id:m.id,label:m.id})).sort((a:any,b:any)=>a.label.localeCompare(b.label));
  }catch{}})());

  const googleKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(googleKey) tasks.push((async()=>{try{
    const d=await fetchJson("https://generativelanguage.googleapis.com/v1beta/models?key="+encodeURIComponent(googleKey));
    providers.google.models=(d.models||[]).map((m:any)=>({id:String(m.name||"").replace(/^models\//,""),label:m.displayName||m.name})).filter((m:any)=>m.id);
  }catch{}})());

  if(process.env.XAI_API_KEY) tasks.push((async()=>{try{
    const d=await fetchJson("https://api.x.ai/v1/models",{Authorization:"Bearer "+process.env.XAI_API_KEY!});
    providers.xai.models=(d.data||[]).map((m:any)=>({id:m.id,label:m.id})).sort((a:any,b:any)=>a.label.localeCompare(b.label));
  }catch{}})());

  if(process.env.GROQ_API_KEY) tasks.push((async()=>{try{
    const d=await fetchJson(process.env.GROQ_BASE_URL ? process.env.GROQ_BASE_URL.replace(/\/$/,"")+"/models" : "https://api.groq.com/openai/v1/models",{Authorization:"Bearer "+process.env.GROQ_API_KEY!});
    providers.groq.models=(d.data||[]).map((m:any)=>({id:m.id,label:m.id})).sort((a:any,b:any)=>a.label.localeCompare(b.label));
  }catch{}})());

  await Promise.all(tasks);
  return NextResponse.json({providers:Object.values(providers),source:"live-provider-model-apis"});
}
