import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCategory, incomeAndTransferCategories } from '../src/lib/categories.js';
import {
  netExpenseOf,
  reimbursedAmountOf,
  isReimbursementIncome,
  netIncomeOf,
  computeFourPillarBreakdown,
} from '../src/lib/finance.js';
import type { Transaction } from '../src/types/index.js';

const makeTx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  userId: 'user-1',
  amount: '200.00',
  type: 'Expense',
  walletId: 'wallet-cash',
  category: '🤝 Loan Given',
  notes: 'Loan given to Brother',
  createdAt: '2026-04-10T12:00:00.000Z',
  ...overrides,
});

test('Loan Given category normalizes cleanly and is part of canonical categories', () => {
  assert.ok((incomeAndTransferCategories as readonly string[]).includes('🤝 Loan Given'));
  assert.equal(normalizeCategory('loan given'), '🤝 Loan Given');
  assert.equal(normalizeCategory('lent money'), '🤝 Loan Given');
  assert.equal(normalizeCategory('money lent'), '🤝 Loan Given');
  assert.equal(normalizeCategory('🤝 Loan Given'), '🤝 Loan Given');
});

test('Lending 200 MAD to Brother has 0 MAD net personal expense while fully reimbursable', () => {
  const loanGivenTx = makeTx({
    amount: '200.00',
    type: 'Expense',
    category: '🤝 Loan Given',
    notes: 'Loan given to Brother',
    reimbursableAmount: '200.00',
    linkedDebtType: 'Receivable',
    linkedContactName: 'Brother',
    splits: [
      {
        id: 'split-1',
        reimbursableAmount: '200.00',
        linkedContactId: 'debt-brother',
        linkedContactName: 'Brother',
        linkedDebtType: 'Receivable',
      },
    ],
  });

  assert.equal(reimbursedAmountOf(loanGivenTx), 200);
  assert.equal(netExpenseOf(loanGivenTx), 0);
});

test('Repayment of 200 MAD from Brother is recognized as reimbursement and not earned income', () => {
  const repaymentTx = makeTx({
    id: 'tx-repay',
    amount: '200.00',
    type: 'Income',
    category: '🔙 Reimbursement',
    notes: 'Settlement for Brother',
    linkedDebtType: 'Receivable',
    linkedContactName: 'Brother',
    splits: [
      {
        id: 'split-repay',
        reimbursableAmount: '200.00',
        linkedContactId: 'debt-brother',
        linkedContactName: 'Brother',
        linkedDebtType: 'Receivable',
      },
    ],
  });

  assert.equal(isReimbursementIncome(repaymentTx), true);
  assert.equal(netIncomeOf(repaymentTx), 0);
});

test('Four-pillar breakdown excludes a 200 MAD loan given from living spending and excludes repayment from earned income', () => {
  const salaryTx = makeTx({
    id: 'tx-salary',
    amount: '10000.00',
    type: 'Income',
    category: '📥 Income',
    notes: 'April Salary',
    createdAt: '2026-04-01T10:00:00.000Z',
  });

  const loanGivenTx = makeTx({
    id: 'tx-loan-brother',
    amount: '200.00',
    type: 'Expense',
    category: '🤝 Loan Given',
    notes: 'Loan given to Brother',
    reimbursableAmount: '200.00',
    linkedDebtType: 'Receivable',
    linkedContactName: 'Brother',
    createdAt: '2026-04-05T10:00:00.000Z',
  });

  const repaymentTx = makeTx({
    id: 'tx-repay-brother',
    amount: '200.00',
    type: 'Income',
    category: '🔙 Reimbursement',
    notes: 'Settlement for Brother',
    linkedDebtType: 'Receivable',
    linkedContactName: 'Brother',
    createdAt: '2026-04-12T10:00:00.000Z',
  });

  const breakdown = computeFourPillarBreakdown({
    transactions: [salaryTx, loanGivenTx, repaymentTx],
    year: 2026,
    month: 4,
    wallets: [{ id: 'wallet-cash', type: 'Cash' }],
  });

  assert.equal(breakdown.periodIncome, 10000);
  assert.equal(breakdown.reimbursedIncomeExcluded, 200);
  assert.equal(breakdown.totalLivingSpent, 0);
  assert.equal(breakdown.spentOnMyself, 0);
  assert.equal(breakdown.spentOnObligations, 0);
});

test('Forgiving 50 MAD of a 200 MAD loan reduces reimbursableAmount to 150 MAD so 50 MAD becomes realized net expense', () => {
  const partiallyForgivenLoanTx = makeTx({
    amount: '200.00',
    type: 'Expense',
    category: '🤝 Loan Given',
    reimbursableAmount: '150.00',
    linkedDebtType: 'Receivable',
    linkedContactName: 'Brother',
  });

  assert.equal(reimbursedAmountOf(partiallyForgivenLoanTx), 150);
  assert.equal(netExpenseOf(partiallyForgivenLoanTx), 50);
});
