import { prisma } from "@/lib/prisma";

export async function getProjectContext(projectId:string, conversationId?:string){
  const [project,messages,executions,memories]=await Promise.all([
    prisma.project.findUnique({where:{id:projectId},select:{id:true,name:true,slug:true,updatedAt:true}}),
    conversationId
      ? prisma.message.findMany({where:{conversationId:conversationId},orderBy:{createdAt:"desc"},take:20,select:{role:true,content:true}})
      : Promise.resolve([]),
    prisma.agentExecution.findMany({where:{projectId},orderBy:{startedAt:"desc"},take:5,select:{status:true,prompt:true,result:true,error:true,startedAt:true}}),
    prisma.projectMemory.findMany({where:{projectId},orderBy:{updatedAt:"desc"},take:20,select:{kind:true,key:true,content:true,updatedAt:true}})
  ]);
  return {
    project,
    history:messages.reverse().map(m=>({role:(m.role==="ASSISTANT"?"assistant":"user") as "assistant"|"user",content:m.content})),
    executions,
    memories
  };
}

export async function upsertProjectMemory(projectId:string,kind:string,key:string,content:string){
  return prisma.projectMemory.upsert({
    where:{projectId_key:{projectId,key}},
    create:{projectId,kind,key,content},
    update:{kind,content}
  });
}