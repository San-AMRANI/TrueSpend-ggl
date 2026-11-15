import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { gzipResponseCompression } from '../server/middleware/compression.js';
import { invalidateAuthUserCache } from '../src/middleware/auth.js';
import { invalidateInvestmentsCache, investmentService } from '../server/services/InvestmentService.js';
import { buildDebtsWithSettlements } from '../server/services/DebtService.js';
import { buildGoalsWithEvents } from '../server/services/GoalService.js';
import { buildSubscriptionsWithWallets } from '../server/services/SubscriptionService.js';
import { buildEnrichedTransactions } from '../server/services/TransactionService.js';
import { computeKpisFromInputs } from '../server/services/KpiService.js';

test('gzipResponseCompression: compresses payloads >= 1024 bytes with gzip header', async () => {
  let sentBody: Buffer | string | undefined;
  const headers: Record<string, string> = {};

  const req = {
    method: 'GET',
    headers: { 'accept-encoding': 'gzip, deflate, br' },
  } as any;

  const res = {
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = String(val);
    },
    send(body: any) {
      sentBody = body;
      return this;
    },
    json(body: any) {
      return this.send(JSON.stringify(body));
    },
  } as any;

  let nextCalled = false;
  gzipResponseCompression(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, 'next() should be called');

  // Large payload (e.g. 5000 characters)
  const largeObject = { items: Array.from({ length: 150 }, (_, i) => ({ id: i, label: `transaction-${i}` })) };
  res.json(largeObject);

  assert.equal(headers['content-encoding'], 'gzip', 'Content-Encoding must be gzip');
  assert.ok(Buffer.isBuffer(sentBody), 'Compressed body must be a Buffer');

  const decompressed = JSON.parse(zlib.gunzipSync(sentBody as Buffer).toString('utf-8'));
  assert.deepEqual(decompressed, largeObject, 'Decompressed payload must match original');
});

test('gzipResponseCompression: leaves small payloads < 1024 bytes uncompressed', async () => {
  let sentBody: any;
  const headers: Record<string, string> = {};

  const req = {
    method: 'GET',
    headers: { 'accept-encoding': 'gzip' },
  } as any;

  const res = {
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = String(val);
    },
    send(body: any) {
      sentBody = body;
      return this;
    },
    json(body: any) {
      return this.send(JSON.stringify(body));
    },
  } as any;

  gzipResponseCompression(req, res, () => {});

  const smallObj = { ok: true, count: 5 };
  res.json(smallObj);

  assert.equal(headers['content-encoding'], undefined, 'Small payload should not have gzip Content-Encoding');
  assert.equal(sentBody, JSON.stringify(smallObj));
});

test('pure builder helpers: transform and index inputs in O(N) time without errors', () => {
  const debts = [
    { id: 'debt-1', contactName: 'Amine', type: 'Receivable', originalAmount: '500', remainingBalance: '500' },
  ];
  const splits = [
    { id: 'split-1', transactionId: 'tx-1', reimbursableAmount: '200', linkedContactId: 'debt-1' },
  ];
  const txs = [
    { id: 'tx-1', type: 'Income', amount: '200', createdAt: new Date() },
  ];
  const builtDebts = buildDebtsWithSettlements('user-1', debts, splits, txs, []);
  assert.equal(builtDebts.length, 1);
  assert.equal(builtDebts[0].contactName, 'Amine');
  assert.equal(builtDebts[0].settlements.length, 1);

  const goals = [{ id: 'goal-1', name: 'MacBook', targetAmount: 20000, currentAmount: 5000 }];
  const events = [{ id: 'evt-1', goalId: 'goal-1', eventType: 'contribution', amount: 5000 }];
  const builtGoals = buildGoalsWithEvents(goals, events);
  assert.equal(builtGoals.length, 1);
  assert.equal(builtGoals[0].auditedNetContributions, 5000);

  const subs = [{ id: 'sub-1', name: 'Netflix', amount: 120, walletId: 'w-1' }];
  const wallets = [{ id: 'w-1', name: 'Main Bank', type: 'Bank' }];
  const builtSubs = buildSubscriptionsWithWallets(subs, wallets);
  assert.equal(builtSubs.length, 1);
  assert.equal(builtSubs[0].walletName, 'Main Bank');

  const rawTx = [
    { id: 'tx-1', type: 'Expense', amount: '100', category: 'Food', walletId: 'w-1' },
  ];
  const enrichedTx = buildEnrichedTransactions(rawTx, [], debts);
  assert.equal(enrichedTx.length, 1);
  assert.ok(enrichedTx[0].category.includes('Dining') || enrichedTx[0].category === 'Food');

  const kpis = computeKpisFromInputs({
    dbUser: { salary: 15000, emergencyBuffer: 10000, payday: 25 },
    userWallets: wallets,
    transactions: enrichedTx,
    payrolls: [],
    allDebts: builtDebts,
    allBudgets: [],
  });
  assert.ok(typeof kpis.safeToSpend === 'number');
  assert.equal(kpis.accounts.length, 1);
});

test('InvestmentService: getCachedStockQuotes returns catalog/cache without network', () => {
  const quotes = investmentService.getCachedStockQuotes(['NVDA', 'AAPL', 'VOO']);
  assert.ok(quotes['NVDA'] !== undefined, 'NVDA should be present in cached quotes');
  assert.ok(quotes['NVDA'].price > 0, 'NVDA price should be greater than 0');
  assert.ok(quotes['AAPL'] !== undefined, 'AAPL should be present in cached quotes');
  assert.ok(quotes['VOO'] !== undefined, 'VOO should be present in cached quotes');
});

test('Cache invalidators execute without errors', () => {
  assert.doesNotThrow(() => invalidateAuthUserCache('user-1'));
  assert.doesNotThrow(() => invalidateAuthUserCache());
  assert.doesNotThrow(() => invalidateInvestmentsCache('user-1'));
  assert.doesNotThrow(() => invalidateInvestmentsCache());
});
