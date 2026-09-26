import { prisma } from "@/lib/prisma";

const activeRuns=new Map<string,{cancel:()=>void}>();

export function registerExecution(id:string,cancel:()=>void){activeRuns.set(id,{cancel});}
export function unregisterExecution(id:string){activeRuns.delete(id);}
export function requestExecutionCancel(id:string){
  const run=activeRuns.get(id);
  if(!run)return false;
  run.cancel();
  return true;
}
export function isExecutionActive(id:string){return activeRuns.has(id);}

export async function markCancelRequested(id:string){
  await prisma.agentExecution.updateMany({where:{id},data:{cancelRequested:true,status:"CANCEL_REQUESTED"}});
}