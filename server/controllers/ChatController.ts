import { Request, Response } from 'express';
import { getChatCompletion, generateSpeechFromText } from '../services/ChatService.js';
import {
  getModelStatusList,
  clearAllModelQuotas,
  isModelQuotaExhausted,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_LITE,
} from '../services/GeminiClient.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, contextData, sessionId, image, selectedModel, allowFallback = true } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(
      messages,
      contextData,
      sessionId,
      image,
      selectedModel,
      allowFallback !== false,
    );
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      res.json({
        reply: String(parsed.reply || ''),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(String) : [],
        modelUsed: completion.modelUsed,
        requestedModel: completion.requestedModel,
        responseTimeMs: completion.responseTimeMs,
        quotaFallback: Boolean(completion.quotaFallback),
        fallbackReason: completion.fallbackReason,
      });
    } catch {
      res.json({
        reply: content,
        actions: [],
        suggestions: [],
        modelUsed: completion.modelUsed,
        requestedModel: completion.requestedModel,
        responseTimeMs: completion.responseTimeMs,
        quotaFallback: Boolean(completion.quotaFallback),
        fallbackReason: completion.fallbackReason,
      });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with AI' });
  }
};

export const getChatModels = (_req: Request, res: Response) => {
  try {
    const models = getModelStatusList();
    const isPrimaryExhausted = isModelQuotaExhausted(MODEL_FLASH_DEEP);
    res.json({
      models,
      currentAutoPrimary: isPrimaryExhausted ? MODEL_FLASH_LITE : MODEL_FLASH_DEEP,
      isAutoFallenBack: isPrimaryExhausted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get models status' });
  }
};

export const resetModelCooldowns = (_req: Request, res: Response) => {
  try {
    clearAllModelQuotas();
    res.json({
      success: true,
      message: 'All Gemini model cooldown timers have been cleared.',
      models: getModelStatusList(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset model cooldowns' });
  }
};

export const speakAiText = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required for speech synthesis' });
    }

    const audioResult = await generateSpeechFromText(text);
    res.json(audioResult);
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message || 'Failed to synthesize speech' });
  }
};

