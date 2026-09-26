export type DetectedLanguage = {
  code: string;
  name: string;
  confidence: number;
  candidates: Array<{ code: string; name: string; confidence: number }>;
  mixed: boolean;
};

type Profile = { code:string; name:string; words:string[]; chars?:RegExp };

const PROFILES:Profile[] = [
  { code:"rw", name:"Kinyarwanda", words:["muraho","mwaramutse","mwiriwe","murakoze","ndashaka","ndifuza","nkeneye","mbwira","bikore","komeza","yego","oya","ese","iki","iki?","hari","ni gute","wabikora","ndabizi","ntabwo","ariko","kandi","muri","kugeza","gute","umuntu","akazi","urubuga","amafaranga","ndashaka ko","nkorera"] },
  { code:"en", name:"English", words:["the","and","is","are","you","your","please","help","want","need","make","build","create","continue","fix","how","what","where","with","for","from","this","that","can","should","would"] },
  { code:"fr", name:"French", words:["bonjour","salut","merci","vous","nous","avec","pour","dans","une","des","les","est","sont","faire","fais","besoin","veux","voulez","comment","pourquoi","mais","et","que","qui"] },
  { code:"sw", name:"Swahili", words:["habari","hujambo","asante","tafadhali","nina","nataka","unahitaji","fanya","endelea","rekebisha","jinsi","nini","kwa","na","ya","ni","hii","hiyo","sana","wapi","kazi","tovuti"] },
  { code:"es", name:"Spanish", words:["hola","gracias","por","favor","quiero","necesito","hacer","crear","construir","arreglar","cómo","qué","dónde","para","una","los","las","es","son","esto","eso","puede"] },
  { code:"pt", name:"Portuguese", words:["olá","obrigado","obrigada","por","favor","quero","preciso","fazer","criar","construir","corrigir","como","que","onde","para","uma","os","as","é","são","isso"] },
];

const normalize=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s?']/gu," ").replace(/\s+/g," ").trim();

export function detectLanguage(input:string):DetectedLanguage {
  const text=normalize(input);
  if(!text) return {code:"unknown",name:"Unknown",confidence:0,candidates:[],mixed:false};
  const tokens=new Set(text.split(/\s+/));
  const scored=PROFILES.map(profile=>{
    let score=0;
    for(const phrase of profile.words){
      const p=normalize(phrase);
      if(p.includes(" ")) { if(text.includes(p)) score+=2; }
      else if(tokens.has(p)) score+=1;
    }
    if(profile.code==="rw" && /[’']/u.test(text)) score+=0.1;
    return {code:profile.code,name:profile.name,score};
  }).sort((a,b)=>b.score-a.score);
  const top=scored[0];
  const total=Math.max(1,scored.reduce((sum,item)=>sum+item.score,0));
  const confidence=Math.min(0.99,top.score/Math.max(2,total*0.65));
  const candidates=scored.filter(item=>item.score>0).slice(0,4).map(item=>({code:item.code,name:item.name,confidence:Math.min(0.99,item.score/Math.max(2,total*0.65))}));
  const second=scored[1];
  const mixed=Boolean(second && second.score>=Math.max(2,top.score*0.55));
  return {code:confidence<0.28?"unknown":top.code,name:confidence<0.28?"Unknown":top.name,confidence:candidates[0]?.confidence||0,candidates,mixed};
}

export function languageInstruction(detected:DetectedLanguage) {
  if(detected.code==="unknown") return "Respond in the language used by the user. If the language is ambiguous, use the dominant language from the recent conversation.";
  return `The user's detected language is ${detected.name} (${detected.code}), confidence ${Math.round(detected.confidence*100)}%. Reply in that language unless the user explicitly requests another language. Preserve code, commands, filenames, URLs, and technical identifiers exactly.`;
}
