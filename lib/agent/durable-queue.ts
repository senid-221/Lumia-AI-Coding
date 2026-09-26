import { Redis } from "@upstash/redis";

const redis=process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN})
  : null;

const queueKey="lumia:agent:queue";

export type AgentJob={executionId:string;projectId:string;conversationId:string;prompt:string};

export async function enqueueAgentJob(job:AgentJob){
  if(!redis) return false;
  await redis.rpush(queueKey,JSON.stringify(job));
  return true;
}

export async function dequeueAgentJob(){
  if(!redis) return null;
  const item=await redis.lpop<string>(queueKey);
  return item?JSON.parse(item) as AgentJob:null;
}

export function durableQueueConfigured(){return Boolean(redis);}