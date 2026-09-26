import { prisma } from "@/lib/prisma";

export async function getProjectContext(projectId:string, conversationId?:string){
  const [project,messages,executions,memories]=await Promise.all([
    prisma.project.findUnique({where:{id:projectId},select:{id:true,name:true,slug:true,updatedAt:true,userId:true}}),
    conversationId
      ? prisma.message.findMany({where:{conversationId:conversationId},orderBy:{createdAt:"desc"},take:20,select:{role:true,content:true}})
      : Promise.resolve([]),
    prisma.agentExecution.findMany({where:{projectId},orderBy:{startedAt:"desc"},take:5,select:{status:true,prompt:true,result:true,error:true,startedAt:true}}),
    prisma.projectMemory.findMany({where:{projectId},orderBy:{updatedAt:"desc"},take:20,select:{kind:true,key:true,content:true,updatedAt:true}})
  ]);
  const userMemories = project
    ? await prisma.userMemory.findMany({
        where:{userId:project.userId},
        orderBy:{updatedAt:"desc"},
        take:30,
        select:{kind:true,key:true,content:true,confidence:true,updatedAt:true}
      })
    : [];

  return {
    project,
    history:messages.reverse().map(m=>({role:(m.role==="ASSISTANT"?"assistant":"user") as "assistant"|"user",content:m.content})),
    executions,
    memories,
    userMemories
  };
}

export async function upsertProjectMemory(projectId:string,kind:string,key:string,content:string){
  return prisma.projectMemory.upsert({
    where:{projectId_key:{projectId,key}},
    create:{projectId,kind,key,content},
    update:{kind,content}
  });
}

export async function upsertUserMemory(
  userId:string,
  kind:string,
  key:string,
  content:string,
  confidence=1
){
  return prisma.userMemory.upsert({
    where:{userId_key:{userId,key}},
    create:{userId,kind,key,content,confidence},
    update:{kind,content,confidence}
  });
}

export async function rememberExplicitUserContext(
  userId:string,
  input:string
){
  const memories:Array<{kind:string;key:string;content:string;confidence:number}> = [];
  const value=input.trim();

  const preference=value.match(/(?:i|I)\s+(?:prefer|like|love|want)\s+(.+)/);
  if(preference){
    const content=preference[1].replace(/[.!?]+$/,"").trim();
    if(content) memories.push({kind:"preference",key:"preference:"+content.toLowerCase().slice(0,120),content,confidence:.9});
  }

  const name=value.match(/(?:my name is|call me)\s+([A-Za-z][A-Za-z0-9 _-]{1,60})/i);
  if(name){
    const content=name[1].trim();
    memories.push({kind:"identity",key:"user-name",content,confidence:1});
  }

  const goal=value.match(/(?:I am|I'm|I am currently)\s+(?:building|working on|developing)\s+(.+)/i);
  if(goal){
    const content=goal[1].replace(/[.!?]+$/,"").trim();
    if(content) memories.push({kind:"goal",key:"current-goal",content,confidence:.85});
  }

  for(const memory of memories){
    await upsertUserMemory(userId,memory.kind,memory.key,memory.content,memory.confidence);
  }
  return memories;
}
