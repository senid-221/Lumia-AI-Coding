import OpenAI from "openai";
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120000 });
export const LUMIA_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";