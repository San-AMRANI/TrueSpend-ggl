import assert from 'node:assert/strict';
import { parseReceiptText, receiptProposalAction } from '../server/services/ReceiptExtractionService.js';

const proposal = parseReceiptText('Cafe Atlas\nDate: 2026-09-01\nTotal: 125.50 MAD');

assert.equal(proposal.amount, 125.5);
assert.equal(proposal.transactionDate, '2026-09-01');
assert.equal(proposal.merchant, 'Cafe Atlas');
assert.equal(proposal.category, 'Dining');
assert.equal(receiptProposalAction(proposal).parameters.type, 'Expense');
assert.equal(proposal.missing.length, 0);

console.log('receiptExtraction tests passed');