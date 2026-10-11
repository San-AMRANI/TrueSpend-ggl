import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { executeApprovedAiActions, sanitizeAiActions } from '../services/AiActionGateway.js';

export const approveAiActions = async (req: AuthRequest, res: Response) => {
  try { res.json({ results: await executeApprovedAiActions(req.dbUser.id, sanitizeAiActions(req.body.actions)) }); }
  catch (error: any) { res.status(400).json({ error: error.message || 'Unable to execute actions' }); }
};
