import { Request, Response } from 'express';
import { getChatCompletion } from '../services/ChatService.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, contextData } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(messages, contextData);
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const cleanContent = content.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      res.json({ reply: String(parsed.reply || ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] });
    } catch {
      res.json({ reply: content, actions: [] });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with AI' });
  }
};
