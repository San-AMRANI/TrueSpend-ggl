import { Request, Response } from 'express';
import { getChatCompletion, generateSpeechFromText } from '../services/ChatService.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, contextData, sessionId, image } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(messages, contextData, sessionId, image);
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      res.json({
        reply: String(parsed.reply || ''),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(String) : [],
        modelUsed: completion.modelUsed,
        responseTimeMs: completion.responseTimeMs,
      });
    } catch {
      res.json({
        reply: content,
        actions: [],
        suggestions: [],
        modelUsed: completion.modelUsed,
        responseTimeMs: completion.responseTimeMs,
      });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with AI' });
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
