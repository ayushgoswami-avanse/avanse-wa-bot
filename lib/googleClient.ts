import { GoogleGenAI } from "@google/genai";

/** ADR-006 — a single Google API key now powers both conversation orchestration and
 * search grounding (superseding ADR-002's Anthropic+Gemini split, per user instruction).
 */
let client: GoogleGenAI | null = null;

export function getGoogleClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}
