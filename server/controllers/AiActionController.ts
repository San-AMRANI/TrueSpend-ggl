import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { executeApprovedAiActions, sanitizeAiActions, simulateAiActionsImpact } from '../services/AiActionGateway.js';

export const approveAiActions = async (req: AuthRequest, res: Response) => {
  try {
    const experienceTier = req.experienceTier === 'basic' ? 'basic' : 'advanced';
    res.json({
      results: await executeApprovedAiActions(
        req.dbUser.id,
        sanitizeAiActions(req.body.actions),
        { experienceTier }
      ),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to execute actions' });
  }
};

export const simulateAiActions = async (req: AuthRequest, res: Response) => {
  try {
    const experienceTier = req.experienceTier === 'basic' ? 'basic' : 'advanced';
    const impact = await simulateAiActionsImpact(
      req.dbUser.id,
      sanitizeAiActions(req.body.actions),
      { experienceTier }
    );
    res.json({ impact });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to simulate actions' });
  }
};
