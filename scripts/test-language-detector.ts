import { detectLanguage } from "../lib/agent/language-detector";

const cases: Array<[string,string]> = [
  ["Muraho, ndashaka ko unkorerera urubuga.", "rw"],
  ["Hello, please build this website for me.", "en"],
  ["Bonjour, je veux créer une application.", "fr"],
  ["Habari, tafadhali nisaidie kujenga tovuti.", "sw"],
  ["Hola, quiero crear una aplicación.", "es"],
  ["Olá, quero criar um aplicativo.", "pt"],
  ["Hallo, bitte erstelle eine Website.", "de"],
  ["Ciao, voglio creare un'applicazione.", "it"],
  ["مرحبا، أريد إنشاء موقع.", "ar"],
  ["你好，我想创建一个网站。", "zh"],
  ["こんにちは、ウェブサイトを作ってください。", "ja"],
  ["안녕하세요, 웹사이트를 만들어 주세요.", "ko"],
  ["Привет, создай сайт для меня.", "ru"]
];

for (const [input, expected] of cases) {
  const result = detectLanguage(input);
  if (result.code !== expected || result.confidence < 0.28) {
    throw new Error(`Language detection failed: ${input} -> ${result.code}`);
  }
  console.log(`PASS ${expected}: ${result.code} (${Math.round(result.confidence * 100)}%)`);
}

const unknown = detectLanguage("xyz qqq 123");
if (unknown.code !== "unknown") throw new Error("Unknown language detection failed.");

const mixed = detectLanguage("Please nkorera urubuga.");
if (!mixed.mixed) throw new Error("Mixed-language detection failed.");

console.log("Multi-language detector tests passed.");
