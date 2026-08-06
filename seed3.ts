import { db } from './src/db/index.js';
import { transactions, splits, debts, users } from './src/db/schema.js';

async function seed() {
  const userList = await db.select().from(users).limit(1);
  if (!userList.length) {
    console.log("No user found");
    return;
  }
  const userId = userList[0].id;
  
  await db.delete(splits);
  await db.delete(transactions);
  await db.delete(debts);

  const t = (amount: string, type: any, wallet: any, category: string, notes: string, dateStr: string) => ({
    userId, amount, type, sourceWallet: wallet, category, notes, createdAt: new Date(dateStr)
  });

  const txs = [
    // 1. INFLOWS & INCOME
    t('6036.70', 'Income', 'Bank', 'Salary', 'Oracle R&D Center - Salary / Payroll', '2026-08-01T09:00:00Z'),
    t('100.00', 'Income', 'Bank', 'Repayment', 'Yassmine Amrani - Loan repayment received', '2026-08-01T10:00:00Z'),
    t('10.00', 'Income', 'Cash', 'Gift', 'Sister - Cash gift / help', '2026-08-01T11:00:00Z'),
    t('200.00', 'Income', 'Cash', 'Repayment', 'Friend - Loan repayment received in cash', '2026-08-01T12:00:00Z'),
    t('100.00', 'Income', 'Bank', 'Reimbursement', 'Friend - Reimbursement for cat supplies', '2026-08-05T09:00:00Z'),
    t('20.00', 'Income', 'Cash', 'Reimbursement', 'Friend - Partial reimbursement for Saturday beach lunch', '2026-08-05T10:00:00Z'),

    // 2. BANK & CARD TRANSACTIONS
    t('2100.00', 'Expense', 'Bank', 'Debt Repayment', 'Yassmine Amrani (Loan Repayment)', '2026-08-02T10:00:00Z'),
    t('196.05', 'Expense', 'Bank', 'Groceries', 'Marjane Bouskoura', '2026-08-02T11:00:00Z'),
    t('191.37', 'Expense', 'Bank', 'Utilities', 'SRM Casablanca-Settat', '2026-08-02T12:00:00Z'),
    t('60.00', 'Expense', 'Bank', 'Social', 'McDo Mohammed V (Paid for friends)', '2026-08-02T13:00:00Z'),
    t('54.00', 'Expense', 'Bank', 'Social', 'McDo Aeria G-64 (40 friends + 14 personal)', '2026-08-02T14:00:00Z'),
    t('50.00', 'Expense', 'Bank', 'Telecom', 'Orange Maroc', '2026-08-02T15:00:00Z'),
    t('35.00', 'Expense', 'Bank', 'Food', 'Ben Pause Gourm', '2026-08-02T16:00:00Z'),
    t('30.00', 'Expense', 'Bank', 'Transport', 'Station Prestig (Fuel)', '2026-08-02T17:00:00Z'),
    t('26.00', 'Expense', 'Bank', 'Coffee', 'Boca Oracle', '2026-08-03T09:00:00Z'),
    t('21.00', 'Expense', 'Bank', 'Food', 'McDo Mohammed V', '2026-08-03T10:00:00Z'),
    t('14.00', 'Expense', 'Bank', 'Coffee', 'Boca Oracle Coffee', '2026-08-03T11:00:00Z'),
    t('7.00', 'Expense', 'Bank', 'Coffee', 'Boca Oracle Coffee', '2026-08-03T12:00:00Z'),
    t('26.00', 'Expense', 'Bank', 'Food', 'Boca Oracle', '2026-08-03T13:00:00Z'),
    t('57.00', 'Expense', 'Bank', 'Food', 'Boca Oracle', '2026-08-03T14:00:00Z'),
    t('30.00', 'Expense', 'Bank', 'Coffee', 'Coffee (Personal)', '2026-08-03T15:00:00Z'),
    t('127.00', 'Expense', 'Bank', 'Entertainment', 'Cinema (Spider-Man) (50 Personal + 77 Social)', '2026-08-03T16:00:00Z'),
    t('105.00', 'Expense', 'Bank', 'Groceries', 'Supermarket (14 Biscuits + 91 Cat supplies - Reimbursed)', '2026-08-03T17:00:00Z'),
    t('10.00', 'Expense', 'Bank', 'Telecom', 'Orange (App top-up)', '2026-08-04T10:00:00Z'),
    t('52.30', 'Expense', 'Bank', 'Social', 'Marjane (Beach Lunch) (26.15 Personal + 6.15 treated friend + 20 reimbursed)', '2026-08-05T11:00:00Z'),
    t('39.85', 'Expense', 'Bank', 'Social', 'Marjane (Beach Snacks) (19.93 Personal + 19.92 Friend)', '2026-08-05T12:00:00Z'),
    t('30.00', 'Expense', 'Bank', 'Transport', 'Train (Transport for self, mom, and sister)', '2026-08-06T10:00:00Z'),
    t('138.00', 'Expense', 'Bank', 'Family', 'Shawarma (Dinner)', '2026-08-06T19:00:00Z'),
    t('20.65', 'Expense', 'Bank', 'Groceries', 'Marjane (Soap, water, drinks)', '2026-08-06T20:00:00Z'),

    // 3. ATM WITHDRAWALS (Bank to Cash Transfers)
    t('400.00', 'Transfer', 'Bank', 'Transfer', 'MehDi Card withdrawal', '2026-08-01T13:00:00Z'),
    t('300.00', 'Transfer', 'Bank', 'Transfer', 'Suit rental withdrawal', '2026-08-01T14:00:00Z'),
    t('100.00', 'Transfer', 'Bank', 'Transfer', 'Mom & chicken withdrawal', '2026-08-01T15:00:00Z'),
    t('50.00', 'Transfer', 'Bank', 'Transfer', 'Barbershop withdrawal', '2026-08-01T16:00:00Z'),
    t('100.00', 'Transfer', 'Bank', 'Transfer', 'Friday ATM Withdrawal', '2026-08-04T09:00:00Z'),

    // 4. CASH TRANSACTIONS
    t('300.00', 'Expense', 'Cash', 'Wardrobe', 'Suit rental', '2026-08-01T14:30:00Z'),
    t('200.00', 'Expense', 'Cash', 'Social', 'Loan to friend', '2026-08-01T15:00:00Z'),
    t('72.00', 'Expense', 'Cash', 'Food', 'McDonalds', '2026-08-01T16:00:00Z'),
    t('50.00', 'Expense', 'Cash', 'Family', 'Cash to Mom', '2026-08-01T17:00:00Z'),
    t('50.00', 'Expense', 'Cash', 'Groceries', 'Chicken', '2026-08-01T18:00:00Z'),
    t('45.00', 'Expense', 'Cash', 'Grooming', 'Barbershop (1)', '2026-08-01T19:00:00Z'),
    t('35.00', 'Expense', 'Cash', 'Transport', 'Station fuel', '2026-08-02T09:00:00Z'),
    t('20.00', 'Expense', 'Cash', 'Transport', 'Station fuel', '2026-08-02T10:00:00Z'),
    t('15.00', 'Expense', 'Cash', 'Coffee', 'Coffee', '2026-08-02T11:00:00Z'),
    t('14.00', 'Expense', 'Cash', 'Coffee', 'McCafé', '2026-08-02T12:00:00Z'),
    t('30.00', 'Expense', 'Cash', 'Transport', 'Fuel', '2026-08-02T13:00:00Z'),
    t('20.00', 'Expense', 'Cash', 'Grooming', 'Barbershop (2)', '2026-08-02T14:00:00Z'),
    t('190.00', 'Expense', 'Cash', 'Wardrobe', 'Clothes (Initial Payment)', '2026-08-02T15:00:00Z'),
    t('20.00', 'Expense', 'Cash', 'Social', 'Uber (1) to Cinema (10 Personal + 10 Friend)', '2026-08-04T18:00:00Z'),
    t('26.00', 'Expense', 'Cash', 'Entertainment', 'Chips & Water (Cinema)', '2026-08-04T19:00:00Z'),
    t('33.00', 'Expense', 'Cash', 'Social', 'Uber (2) from Cinema (16.50 Personal + 16.50 Friend)', '2026-08-04T22:00:00Z'),
    t('30.00', 'Expense', 'Cash', 'Transport', 'Fuel (Bike)', '2026-08-04T23:00:00Z'),
    t('10.00', 'Expense', 'Cash', 'Debt Repayment', 'Clothes Repayment', '2026-08-05T09:00:00Z'), // Debt Repayment mapped to Expense for now or Debt Repayment? We'll use Expense type to reduce cash, but category is Debt Repayment. Wait, if it's 'Debt Repayment' type, it might not deduct correctly depending on how you compute. 'Expense' does. Let's use 'Expense'.
    t('1.00', 'Expense', 'Cash', 'Adjustment', 'System Adjustment', '2026-08-05T10:00:00Z'),
    t('6.00', 'Expense', 'Cash', 'Social', 'Beach Seller', '2026-08-05T14:00:00Z'),
    t('4.00', 'Expense', 'Cash', 'Transport', 'Parking', '2026-08-05T15:00:00Z'),
    t('10.00', 'Expense', 'Cash', 'Grooming', 'Barbershop (3)', '2026-08-06T12:00:00Z'),
  ];
  
  // Make sure 'Debt Repayment' uses 'Expense' as type for calculation or adjust `server.ts` to deduct Debt Repayment.
  // Actually, 'Debt Repayment' is usually an 'Expense'. I will set type to 'Expense' for clothes repayment, category 'Debt Repayment'.
  
  await db.insert(transactions).values(txs);

  await db.insert(debts).values([
    { userId, contactName: 'Clothes Seller', type: 'Payable', originalAmount: '210.00', remainingBalance: '10.00', status: 'Pending', createdAt: new Date('2026-08-01T08:00:00Z') },
  ]);
  
  console.log("Seeding complete.");
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
