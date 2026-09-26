export type ProviderId="openai"|"anthropic"|"google";
export type ProviderDescriptor={id:ProviderId;name:string;configured:boolean};

export function getProviderRegistry():ProviderDescriptor[]{
  return [
    {id:"openai",name:"OpenAI",configured:Boolean(process.env.OPENAI_API_KEY)},
    {id:"anthropic",name:"Anthropic",configured:Boolean(process.env.ANTHROPIC_API_KEY)},
    {id:"google",name:"Google",configured:Boolean(process.env.GOOGLE_AI_API_KEY)}
  ];
}

export function getDefaultProvider():ProviderId{
  const value=process.env.LUMIA_PROVIDER as ProviderId|undefined;
  if(value==="anthropic"||value==="google"||value==="openai")return value;
  return "openai";
}