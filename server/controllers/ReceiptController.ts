import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { parseReceiptWithGemini, receiptProposalAction } from '../services/ReceiptExtractionService.js';

export const parseReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const image = req.body?.image;
    const walletId = typeof req.body?.walletId === 'string' ? req.body.walletId : undefined;

    if (!text.trim() && (!image || !image.data)) {
      return res.status(400).json({ error: 'Receipt image or OCR text is required' });
    }

    const proposal = await parseReceiptWithGemini({ text, image, walletId });
    res.json({
      proposal,
      action: proposal.amount === null ? null : receiptProposalAction(proposal),
      requiresReview: true,
    });
  } catch (error: any) {
    console.error('Receipt parse error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse receipt' });
  }
};
