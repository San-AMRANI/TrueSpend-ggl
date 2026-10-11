import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

export const gemini = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Model Constants
export const MODEL_FLASH_LITE = 'gemini-3.1-flash-lite'; // 500 requests/day
export const MODEL_FLASH_DEEP = 'gemini-3.8-flash';      // 20 requests/day
export const MODEL_FLASH_LATEST = 'gemini-flash-latest'; // Standard fallback
export const MODEL_TTS = 'gemini-3.8-flash-lite-tts';    // 10 requests/day

export const PRIMARY_GEMINI_MODEL = MODEL_FLASH_DEEP;
export const FALLBACK_GEMINI_MODEL = MODEL_FLASH_LITE;

export interface ModelCatalogEntry {
  id: string;
  name: string;
  badge: string;
  dailyQuota: number | string;
  rpm: number;
  description: string;
  recommendedFor: string;
  isAvailable: boolean;
  isExhausted: boolean;
  cooldownRemainingSeconds: number;
}

export const SUPPORTED_MODELS_METADATA = [
  {
    id: MODEL_FLASH_DEEP,
    name: 'Gemini 3.8 Flash',
    badge: 'Deep Intelligence',
    dailyQuota: 20,
    rpm: 5,
    description: 'Premier multimodal model with deep financial reasoning, simulation, and comprehensive audits.',
    recommendedFor: 'Complex financial queries & deep reviews',
  },
  {
    id: MODEL_FLASH_LITE,
    name: 'Gemini 3.1 Flash Lite',
    badge: '500 Requests/Day',
    dailyQuota: 500,
    rpm: 15,
    description: 'High-throughput, ultra-fast model with massive daily quota allowance in the free tier.',
    recommendedFor: 'Frequent chat, rapid logs, and continuous day-to-day queries',
  },
  {
    id: MODEL_FLASH_LATEST,
    name: 'Gemini Flash Latest',
    badge: 'Reliable Fallback',
    dailyQuota: 20,
    rpm: 5,
    description: 'Standard stable release fallback model for high reliability and general finance tasks.',
    recommendedFor: 'General usage & redundant failover',
  },
];

// ── In-Memory Quota Exhaustion Monitor ─────────────────────────────────────
// Remembers when a model returns a 429 (Resource Exhausted / Quota Exceeded)
// so subsequent requests instantly failover to high-quota models without lag.
const quotaCooldownMap: Map<string, number> = new Map();

export function isModelQuotaExhausted(model: string): boolean {
  const expiry = quotaCooldownMap.get(model);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    quotaCooldownMap.delete(model);
    return false;
  }
  return true;
}

export function getModelCooldownRemainingSeconds(model: string): number {
  const expiry = quotaCooldownMap.get(model);
  if (!expiry) return 0;
  const remaining = Math.ceil((expiry - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function markModelQuotaExhausted(model: string, cooldownDurationMs = 1000 * 60 * 30): void {
  quotaCooldownMap.set(model, Date.now() + cooldownDurationMs);
  console.warn(`[QuotaMonitor] Model ${model} marked as quota-exhausted until ${new Date(Date.now() + cooldownDurationMs).toLocaleTimeString()}`);
}

export function clearModelQuota(model: string): void {
  quotaCooldownMap.delete(model);
}

export function clearAllModelQuotas(): void {
  quotaCooldownMap.clear();
}

export function getModelStatusList(): ModelCatalogEntry[] {
  return SUPPORTED_MODELS_METADATA.map((m) => {
    const isExhausted = isModelQuotaExhausted(m.id);
    const cooldownRemainingSeconds = getModelCooldownRemainingSeconds(m.id);
    return {
      ...m,
      isAvailable: true,
      isExhausted,
      cooldownRemainingSeconds,
    };
  });
}

