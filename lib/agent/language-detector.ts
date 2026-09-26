export type DetectedLanguage = {
  code: string;
  name: string;
  confidence: number;
  candidates: Array<{ code: string; name: string; confidence: number }>;
  mixed: boolean;
};

type Profile = { code: string; name: string; words: string[]; script?: RegExp };

const PROFILES: Profile[] = [
  { code: "rw", name: "Kinyarwanda", words: ["muraho","mwaramutse","mwiriwe","murakoze","ndashaka","ndifuza","nkeneye","mbwira","bikore","komeza","yego","oya","ese","hari","ni gute","wabikora","ndabizi","ntabwo","ariko","kandi","muri","kugeza","gute","umuntu","akazi","urubuga","amafaranga","nkorera","unkorere","ushaka","turashaka","ndashaka ko"] },
  { code: "en", name: "English", words: ["hello","hi","the","and","is","are","you","your","please","help","want","need","make","build","create","continue","fix","how","what","where","with","for","from","this","that","can","should","would","website","application"] },
  { code: "fr", name: "French", words: ["bonjour","salut","merci","vous","nous","avec","pour","dans","une","des","les","est","sont","faire","fais","besoin","veux","voulez","comment","pourquoi","mais","et","que","qui","site","application","je","tu"] },
  { code: "sw", name: "Swahili", words: ["habari","hujambo","asante","tafadhali","nina","nataka","unahitaji","fanya","endelea","rekebisha","jinsi","nini","kwa","na","ya","ni","hii","hiyo","sana","wapi","kazi","tovuti","kujenga","nisaidie"] },
  { code: "es", name: "Spanish", words: ["hola","gracias","por","favor","quiero","necesito","hacer","crear","construir","arreglar","cómo","qué","dónde","para","una","los","las","es","son","esto","eso","puede","sitio","aplicación","yo"] },
  { code: "pt", name: "Portuguese", words: ["olá","obrigado","obrigada","por","favor","quero","preciso","fazer","criar","construir","corrigir","como","que","onde","para","uma","os","as","é","são","isso","site","aplicativo","eu"] },
  { code: "de", name: "German", words: ["hallo","danke","bitte","ich","du","sie","wir","und","ist","sind","für","mit","von","das","die","der","ein","eine","möchte","brauche","machen","bauen","erstellen","wie","was","wo"] },
  { code: "it", name: "Italian", words: ["ciao","grazie","prego","io","tu","lei","noi","con","per","una","uno","gli","le","è","sono","voglio","bisogno","fare","creare","costruire","come","cosa","dove"] },
  { code: "ar", name: "Arabic", words: [], script: /[\u0600-\u06ff]/u },
  { code: "zh", name: "Chinese", words: [], script: /[\u4e00-\u9fff]/u },
  { code: "ja", name: "Japanese", words: [], script: /[\u3040-\u30ff]/u },
  { code: "ko", name: "Korean", words: [], script: /[\uac00-\ud7af]/u },
  { code: "ru", name: "Russian", words: [], script: /[\u0400-\u04ff]/u }
];

const normalize = (value: string) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}\s?']/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export function detectLanguage(input: string): DetectedLanguage {
  const text = normalize(input);
  if (!text) return { code: "unknown", name: "Unknown", confidence: 0, candidates: [], mixed: false };

  const tokens = new Set(text.split(/\s+/));
  const scored = PROFILES.map(profile => {
    let score = 0;
    for (const word of profile.words) {
      const p = normalize(word);
      if (p.includes(" ")) {
        if (text.includes(p)) score += 2;
      } else if (tokens.has(p)) {
        score += 1;
      }
    }
    if (profile.script) {
      const matches = text.match(profile.script);
      if (matches) score += 5;
    }
    return { code: profile.code, name: profile.name, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const total = Math.max(1, scored.reduce((sum, item) => sum + item.score, 0));
  const confidence = Math.min(0.99, top.score / Math.max(2, total * 0.65));
  const candidates = scored
    .filter(item => item.score > 0)
    .slice(0, 4)
    .map(item => ({
      code: item.code,
      name: item.name,
      confidence: Math.min(0.99, item.score / Math.max(2, total * 0.65))
    }));
  const second = scored[1];
  const mixed = Boolean(second && second.score >= Math.max(2, top.score * 0.55));

  return {
    code: confidence < 0.28 ? "unknown" : top.code,
    name: confidence < 0.28 ? "Unknown" : top.name,
    confidence: candidates[0]?.confidence || 0,
    candidates,
    mixed
  };
}

export function languageInstruction(detected: DetectedLanguage) {
  if (detected.code === "unknown") {
    return "Respond in the language used by the user. If the language is ambiguous, use the dominant language from the recent conversation. Do not invent a language preference from a short ambiguous message.";
  }
  const mixed = detected.mixed ? " The message may contain mixed languages; preserve the user's natural language mix when useful." : "";
  return `The user's detected language is ${detected.name} (${detected.code}), confidence ${Math.round(detected.confidence * 100)}%. Reply in that language unless the user explicitly requests another language.${mixed} Preserve code, commands, filenames, URLs, and technical identifiers exactly.`;
}
