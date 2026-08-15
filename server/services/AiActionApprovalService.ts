import { randomUUID } from 'node:crypto';
import type { AiAction } from './AiActionGateway.js';

type PendingApproval = {
  userId: string;
  actions: AiAction[];
  expiresAt: number;
};

const APPROVAL_TTL_MS = 10 * 60 * 1000;
const pendingApprovals = new Map<string, PendingApproval>();

const removeExpired = () => {
  const now = Date.now();
  for (const [token, approval] of pendingApprovals) {
    if (approval.expiresAt <= now) pendingApprovals.delete(token);
  }
};

/**
 * Stores model-generated parameters server-side. The browser receives only an opaque,
 * short-lived token, so it cannot alter the approved action payload or replay it later.
 */
export function createAiActionApproval(userId: string, actions: AiAction[]) {
  removeExpired();
  const token = randomUUID();
  pendingApprovals.set(token, {
    userId,
    actions: JSON.parse(JSON.stringify(actions)) as AiAction[],
    expiresAt: Date.now() + APPROVAL_TTL_MS,
  });
  return token;
}

export function consumeAiActionApproval(userId: string, token: unknown) {
  if (typeof token !== 'string') throw new Error('Approval token is required');
  const approval = pendingApprovals.get(token);
  pendingApprovals.delete(token);

  if (!approval || approval.expiresAt <= Date.now()) throw new Error('This action proposal has expired. Ask the assistant to prepare it again.');
  if (approval.userId !== userId) throw new Error('This action proposal belongs to another user');
  return approval.actions;
}

export function cancelAiActionApproval(userId: string, token: unknown) {
  if (typeof token !== 'string') return;
  const approval = pendingApprovals.get(token);
  if (approval?.userId === userId) pendingApprovals.delete(token);
}
