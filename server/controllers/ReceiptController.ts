import { parseReceiptText, receiptProposalAction } from '../services/ReceiptExtractionService.js';

export const parseReceipt = (req: AuthRequest, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) return res.status(400).json({ error: 'OCR receipt text is required' });

  const proposal = parseReceiptText(text);
  res.json({
    proposal,
    action: proposal.amount === null ? null : receiptProposalAction(proposal),
    requiresReview: true,
  });
};
