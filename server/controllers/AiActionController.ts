import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { cancelAiActionApproval, consumeAiActionApproval } from '../services/AiActionApprovalService.js';
import { executeApprovedAiActions } from '../services/AiActionGateway.js';

export const approveAiActions = async (req: AuthRequest, res: Response) => {
  try {
    const actions = consumeAiActionApproval(req.dbUser.id, req.body.approvalToken);
    res.json({ results: await executeApprovedAiActions(req.dbUser.id, actions) });
  }
  catch (error: any) { res.status(400).json({ error: error.message || 'Unable to execute actions' }); }
};

export const cancelAiActions = (req: AuthRequest, res: Response) => {
  cancelAiActionApproval(req.dbUser.id, req.body.approvalToken);
  res.status(204).end();
};
