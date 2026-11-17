import { Request, Response } from 'express';
import { getChatCompletion, generateSpeechFromText, parseStructuredAiResponse } from '../services/ChatService.js';
import {
  getModelStatusList,
  clearAllModelQuotas,
  isModelUnavailable,
  MODEL_FLASH_FAST,
  MODEL_FLASH_LITE_PREVIEW,
} from '../services/GeminiClient.js';
import { isLiveWebSocketGatewayActive, LIVE_VOICE_OPTIONS } from '../services/LiveVoiceGateway.js';
import { streamLiveVoiceTurn } from '../services/LiveVoiceHttpService.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const {
      messages,
      contextData,
      sessionId,
      image,
      selectedModel,
      allowFallback = true,
      focusScopes,
      responseDepth = 'deep_creative',
    } = req.body;

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
      Array.isArray(focusScopes) ? focusScopes : undefined,
      responseDepth,
    );
    const content = completion.choices?.[0]?.message?.content || '';
    const parsed = parseStructuredAiResponse(content);
    const experienceTier = (req as any).experienceTier || 'advanced';
    res.json({
      reply: String(parsed.reply || ''),
      actions:
        experienceTier === 'basic'
          ? []
          : Array.isArray(parsed.actions)
          ? parsed.actions
          : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4).map(String) : [],
      modelUsed: completion.modelUsed,
      requestedModel: completion.requestedModel,
      responseTimeMs: completion.responseTimeMs,
      quotaFallback: Boolean(completion.quotaFallback),
      fallbackReason: completion.fallbackReason,
    });
  } catch (error: any) {
    console.error('Chat error in controller:', error);
    res.status(200).json({
      reply: '⚠️ Spex is currently experiencing temporary high demand on cloud AI servers. Please try again in a moment, or tap a quick action below:',
      actions: [],
      suggestions: [
        '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
        '📊 Run a complete financial health audit',
        '💰 What can I safely spend today?',
      ],
      modelUsed: 'TrueSpend Emergency Fallback',
      quotaFallback: true,
      fallbackReason: error.message || 'Temporary upstream congestion',
    });
  }
};

export const getChatModels = (_req: Request, res: Response) => {
  try {
    const models = getModelStatusList();
    const isPrimaryUnavailable = isModelUnavailable(MODEL_FLASH_FAST);
    res.json({
      models,
      currentAutoPrimary: isPrimaryUnavailable ? MODEL_FLASH_LITE_PREVIEW : MODEL_FLASH_FAST,
      isAutoFallenBack: isPrimaryUnavailable,
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

export const getLiveVoiceCapabilities = (_req: Request, res: Response) => {
  const websocketSupported = isLiveWebSocketGatewayActive();
  res.json({
    websocketSupported,
    sseVoiceSupported: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    recommendedTransport: websocketSupported ? 'websocket' : 'sse',
    wsPath: '/api/live',
    sseTurnPath: '/api/chat/live-turn',
    voices: LIVE_VOICE_OPTIONS,
  });
};

export const streamLiveVoiceTurnHandler = async (req: Request, res: Response) => {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();

  const writeSse = (payload: unknown) => {
    if (res.writableEnded || abortController.signal.aborted) return;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  };

  try {
    const {
      audioBase64,
      audioMimeType,
      text,
      voiceName,
      contextData,
      focusScopes,
      history,
    } = req.body || {};

    await streamLiveVoiceTurn(
      {
        audioBase64,
        audioMimeType,
        text,
        voiceName,
        contextData,
        focusScopes,
        history,
        signal: abortController.signal,
      },
      writeSse,
    );
  } catch (err: any) {
    writeSse({
      type: 'error',
      error: err?.message || 'Unable to process live voice turn.',
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};
