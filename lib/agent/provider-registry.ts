export type ProviderId="openai"|"anthropic"|"google"|"zencode";
export type ProviderDescriptor={id:ProviderId;name:string;configured:boolean;baseURL?:string};

export function getProviderRegistry():ProviderDescriptor[]{
  return [
    {id:"openai",name:"OpenAI",configured:Boolean(process.env.OPENAI_API_KEY),baseURL:"https://api.openai.com/v1"},
    {id:"anthropic",name:"Anthropic",configured:Boolean(process.env.ANTHROPIC_API_KEY),baseURL:"https://api.anthropic.com"},
    {id:"google",name:"Google",configured:Boolean(process.env.GOOGLE_AI_API_KEY)},
    {id:"zencode",name:"Zencode",configured:Boolean(process.env.ZENCODE_API_KEY),baseURL:process.env.ZENCODE_BASE_URL||"https://api.z.ai/api/coding/paas/v4"}
  ];
}

export function getDefaultProvider():ProviderId{
  const value=process.env.LUMIA_PROVIDER as ProviderId|undefined;
  if(value==="anthropic"||value==="google"||value==="zencode"||value==="openai")return value;
  return "openai";
}