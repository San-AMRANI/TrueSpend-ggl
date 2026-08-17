import { Request, Response } from 'express';
import { getChatCompletion } from '../services/ChatService.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, contextData, sessionId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(messages, contextData, sessionId);
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      res.json({
        reply: String(parsed.reply || ''),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        responseTimeMs: completion.responseTimeMs,
      });
    } catch {
      res.json({ reply: content, actions: [], responseTimeMs: completion.responseTimeMs });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with AI' });
  }
};
