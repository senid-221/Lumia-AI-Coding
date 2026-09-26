import "dotenv/config";
import { prisma } from "../lib/prisma";
import { dequeueAgentJob } from "../lib/agent/durable-queue";
import { runAutonomousCodingTask } from "../lib/agent/orchestrator";

const POLL_MS=Number(process.env.LUMIA_WORKER_POLL_MS||2000);

async function processJob(){
  const job=await dequeueAgentJob();
  if(!job)return false;
  const execution=await prisma.agentExecution.findUnique({where:{id:job.executionId}});
  if(!execution){
    await prisma.agentExecution.create({data:{id:job.executionId,projectId:job.projectId,conversationId:job.conversationId,status:"QUEUED",prompt:job.prompt}});
  }else if(["CANCELLED","SUCCEEDED"].includes(execution.status)){
    return true;
  }
  await prisma.agentExecution.updateMany({where:{id:job.executionId},data:{status:"RUNNING",queueAttempts:{increment:1},heartbeatAt:new Date()}});

  try{
    await runAutonomousCodingTask(
      job.projectId,
      job.conversationId,
      job.prompt,
      [{role:"user",content:job.prompt}],
      ()=>{},
      job.executionId
    );
  }catch(error){
    const message=error instanceof Error?error.message:"Worker execution failed";
    await prisma.agentExecution.updateMany({
      where:{id:job.executionId},
      data:{status:"FAILED",error:message,finishedAt:new Date()}
    });
  }
  return true;
}

async function main(){
  if(!process.env.UPSTASH_REDIS_REST_URL||!process.env.UPSTASH_REDIS_REST_TOKEN){
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for the worker.");
  }
  console.log("Lumia worker started.");
  while(true){
    try{
      const processed=await processJob();
      if(!processed)await new Promise(r=>setTimeout(r,POLL_MS));
    }catch(error){
      console.error(error);
      await new Promise(r=>setTimeout(r,POLL_MS));
    }
  }
}

void main();