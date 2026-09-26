import OpenAI from "openai";

export function getOpenAIClient(){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({apiKey,maxRetries:2,timeout:120000});
}

export const openai={
  responses:{
    create: (...args:any[]) => getOpenAIClient().responses.create(...args)
  }
};

export const LUMIA_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
