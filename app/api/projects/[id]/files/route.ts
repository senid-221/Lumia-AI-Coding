import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listProjectFiles,readProjectFile,writeProjectFile,searchProjectCode } from "@/lib/agent/project-files";
import { ensureProjectWorkspace } from "@/lib/agent/workspace";
import { NextResponse } from "next/server";

async function authorize(id:string){
  const session=await auth();
  if(!session?.user?.id)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
  const project=await prisma.project.findFirst({where:{id,userId:session.user.id}});
  if(!project)return {error:NextResponse.json({error:"Project not found"},{status:404})};
  await ensureProjectWorkspace(id); return {project};
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params, ok=await authorize(id); if("error" in ok)return ok.error;
  const url=new URL(req.url), action=url.searchParams.get("action")||"list", path=url.searchParams.get("path")||".";
  try{
    if(action==="read")return NextResponse.json({path,content:await readProjectFile(id,path)});
    if(action==="search")return NextResponse.json({results:await searchProjectCode(id,url.searchParams.get("query")||"",path)});
    return NextResponse.json({files:await listProjectFiles(id,path)});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Workspace error"},{status:400});}
}
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params,ok=await authorize(id); if("error" in ok)return ok.error;
  const body=await req.json().catch(()=>({})); const file=String(body.path||""); const content=String(body.content??"");
  if(!file)return NextResponse.json({error:"path is required"},{status:400});
  try{return NextResponse.json({file:await writeProjectFile(id,file,content)});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Write failed"},{status:400});}
}