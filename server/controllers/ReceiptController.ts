import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { parseReceiptWithGemini, receiptProposalAction } from '../services/ReceiptExtractionService.js';
import { coreAuditService } from '../services/CoreAuditService.js';

export const parseReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const image = req.body?.image;
    const walletId = typeof req.body?.walletId === 'string' ? req.body.walletId : undefined;

    if (!text.trim() && (!image || !image.data)) {
      return res.status(400).json({ error: 'Receipt image or OCR text is required' });
    }

    const proposal = await parseReceiptWithGemini({ text, image, walletId });
    let reviewItem = null;
    if (req.dbUser?.id) {
      try {
        reviewItem = await coreAuditService.createReviewItem(req.dbUser.id, {
          sourceType: 'receipt_ocr',
          confidenceScore: (proposal.confidence ?? 65) / 100,
          parsedAmount: proposal.amount ?? 0,
          parsedCurrency: 'MAD',
          parsedDate: proposal.transactionDate || new Date().toISOString().slice(0, 10),
          parsedDescription: proposal.merchant || proposal.notes || 'Receipt Capture',
          parsedCategory: proposal.category || '🛒 Groceries',
          parsedType: 'Expense',
          walletId: proposal.walletId || walletId || null,
          rawPayloadJson: JSON.stringify(proposal),
        });
      } catch (inboxErr) {
        console.warn('Could not persist receipt to review inbox:', inboxErr);
      }
    }

    res.json({
      proposal,
      action: proposal.amount === null ? null : receiptProposalAction(proposal),
      reviewItem,
      requiresReview: true,
    });
  } catch (error: any) {
    console.error('Receipt parse error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse receipt' });
  }
};
