import OpenAI from "openai";

export function getZencodeClient(){
  const apiKey=process.env.ZENCODE_API_KEY;
  if(!apiKey)throw new Error("ZENCODE_API_KEY is not configured");
  const baseURL=process.env.ZENCODE_BASE_URL||"https://api.z.ai/api/coding/paas/v4";
  return new OpenAI({apiKey,baseURL,maxRetries:2,timeout:120000});
}
