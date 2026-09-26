import { detectLanguage } from "../lib/agent/language-detector";

const cases=[
  ["Muraho, ndashaka ko unkorerera urubuga.", "rw"],
  ["Hello, please build this website for me.", "en"],
  ["Bonjour, je veux créer une application.", "fr"],
  ["Habari, tafadhali nisaidie kujenga tovuti.", "sw"],
  ["Hola, quiero crear una aplicación.", "es"],
];

for(const [input,expected] of cases){
  const result=detectLanguage(input);
  if(result.code!==expected || result.confidence<0.28) throw new Error(`Language detection failed: ${input} -> ${result.code}`);
  console.log(`PASS ${expected}: ${result.code} (${Math.round(result.confidence*100)}%)`);
}
console.log("Multi-language detector tests passed.");
