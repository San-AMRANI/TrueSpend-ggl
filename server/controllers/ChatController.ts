import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { createAiActionApproval } from '../services/AiActionApprovalService.js';
import { sanitizeAiActions } from '../services/AiActionGateway.js';
import { getChatCompletion } from '../services/ChatService.js';

export const chatWithAi = async (req: AuthRequest, res: Response) => {
  try {
    const { messages, contextData } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await getChatCompletion(messages, contextData);
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
      const actions = sanitizeAiActions(parsed.actions);
      const approvalToken = actions.length ? createAiActionApproval(req.dbUser.id, actions) : undefined;
      res.json({
        reply: String(parsed.reply || ''),
        // Parameters remain server-side until the user approves. This prevents a client
        // from modifying a model proposal between display and execution.
        actions: actions.map(({ type, summary }) => ({ type, summary })),
        approvalToken,
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
