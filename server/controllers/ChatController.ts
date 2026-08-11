import { Request, Response } from 'express';
import { getFreeModels, getChatCompletion } from '../services/ChatService.js';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, contextData } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(messages, contextData);
    res.json(completion);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with AI' });
  }
};
