import assert from 'node:assert/strict';
import { CoreAuditService } from '../server/services/CoreAuditService.js';
import {
  clearOfflineFinancialCachesOnLogout,
  forceDiscardOfflineOutbox,
  encryptPayloadForUser,
  decryptPayloadForUser,
  calculateBackoffMs,
  loadDecryptedOfflineOutbox,
  enqueueOfflineTransaction,
} from '../src/lib/offlineOutbox.js';

function setupMemoryStorage() {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
  };
  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  return store;
}

const mockWalletExecutor = {
  select: () => ({
    from: () => ({
      where: async () => [
        { id: 'w-1', name: 'Main Bank', accountSubtype: 'Checking' },
        { id: 'w-2', name: 'Credit Card', accountSubtype: 'CreditCard' },
      ],
    }),
  }),
} as any;

async function runTests() {
  const svc = new CoreAuditService();

  // 1. Double-entry balanced posting invariant across Expense, Income, Transfer, Debt Repayment & FX
  {
    const txTypes: Array<{
      type: 'Expense' | 'Income' | 'Transfer' | 'Debt Repayment';
      amount: string;
      nativeAmount?: string;
      currency?: string;
      exchangeRateUsed?: string;
    }> = [
      { type: 'Expense', amount: '450.75', nativeAmount: '45.00', currency: 'EUR', exchangeRateUsed: '10.016667' },
      { type: 'Income', amount: '12500.00', nativeAmount: '12500.00', currency: 'MAD', exchangeRateUsed: '1.000000' },
      { type: 'Transfer', amount: '2000.00' },
      { type: 'Debt Repayment', amount: '875.50' },
    ];

    for (const tx of txTypes) {
      const { entryType, lines } = await svc.buildBalancedLinesForTransaction(
        'user-1',
        {
          id: 'tx-1',
          type: tx.type,
          amount: tx.amount,
          nativeAmount: tx.nativeAmount ?? tx.amount,
          currency: tx.currency ?? 'MAD',
          exchangeRateUsed: tx.exchangeRateUsed ?? '1',
          category: 'Test',
          walletId: 'w-1',
          destinationWalletId: 'w-2',
          notes: 'Invariant check',
        },
        mockWalletExecutor
      );
      assert.ok(entryType.length > 0);
      assert.ok(lines.length >= 2, `Expected >= 2 journal lines for ${tx.type}`);
      const debits = lines.reduce((s, l) => s + Number(l.debitMad), 0);
      const credits = lines.reduce((s, l) => s + Number(l.creditMad), 0);
      assert.ok(
        Math.abs(debits - credits) < 0.005,
        `Journal must balance for ${tx.type}: debits=${debits}, credits=${credits}`
      );
    }
    console.log('✓ Test 1 passed: Double-entry journal lines always balance across all transaction types and FX conversions.');
  }

  // 2. Debt installment amortization schedule accuracy & principal/interest breakdown
  {
    const schedule = svc.generateDebtInstallmentSchedule({
      id: 'debt-1',
      contactName: 'Car Loan',
      type: 'Payable',
      remainingBalance: 10000,
      installmentAmount: 1000,
      installmentFrequency: 'monthly',
      interestRateApr: 6,
      feesAmount: 25,
      dueDate: '2026-01-15',
      currency: 'MAD',
    });
    assert.ok(schedule.length >= 10 && schedule.length <= 12, `Expected 10-12 monthly installments, got ${schedule.length}`);
    const totalPrincipal = schedule.reduce((s, i) => s + i.principalComponent, 0);
    assert.ok(
      Math.abs(totalPrincipal - 10000) < 0.05,
      `Amortized principal sum (${totalPrincipal}) must match initial principal (10000)`
    );
    const totalFees = schedule.reduce((s, i) => s + i.feeComponent, 0);
    assert.equal(Number(totalFees.toFixed(2)), 25, 'Fee should appear on first installment');
    assert.equal(schedule[0].expectedDate, '2026-01-15');
    assert.equal(schedule[1].expectedDate, '2026-02-15');
    console.log('✓ Test 2 passed: Debt installment amortization schedule reconciles principal, interest, fees, and dates.');
  }

  // 3. Net Worth Change Bridge arithmetic attribution
  {
    const bridge = svc.computeNetWorthChangeBridge(
      {
        bankBalanceMad: 10000,
        cashBalanceMad: 1000,
        savingsBalanceMad: 5000,
        investmentCashMad: 2000,
        creditCardLiabilityMad: 500,
        overdraftLiabilityMad: 0,
        receivablesMad: 1200,
        payablesMad: 400,
        investmentMarketValueMad: 8000,
        externalAssetsMad: 100000,
        externalLiabilitiesMad: 20000,
        totalNetWorthMad: 106300,
      },
      {
        bankBalanceMad: 14000,
        cashBalanceMad: 1500,
        savingsBalanceMad: 7000,
        investmentCashMad: 2500,
        creditCardLiabilityMad: 200,
        overdraftLiabilityMad: 0,
        receivablesMad: 1000,
        payablesMad: 100,
        investmentMarketValueMad: 9500,
        externalAssetsMad: 102000,
        externalLiabilitiesMad: 19000,
        totalNetWorthMad: 118200,
      }
    );
    const sumDeltas =
      bridge.deltaLiquidCashMad +
      bridge.deltaCreditDebtMad +
      bridge.deltaReceivablesMad +
      bridge.deltaPayablesMad +
      bridge.deltaInvestmentsMad +
      bridge.deltaExternalNetMad;
    assert.ok(
      Math.abs(sumDeltas - bridge.totalDeltaMad) < 0.01,
      `Sum of bridge deltas (${sumDeltas}) must equal totalDeltaMad (${bridge.totalDeltaMad})`
    );
    assert.equal(bridge.totalDeltaMad, 11900);
    console.log('✓ Test 3 passed: Net worth change bridge components sum strictly to totalDeltaMad.');
  }

  // 4. Deterministic rule condition evaluation (matching + non-matching)
  {
    const cond = {
      transactionType: 'Expense',
      minAmount: 500,
      maxAmount: 2000,
      counterparty: 'marjane',
      withinDays: 5,
    };
    const pass = svc.evaluateRuleConditions(cond, {
      transactionType: 'Expense',
      amount: 1250,
      counterparty: 'Marjane Market Rabat',
      withinDays: 3,
    });
    assert.equal(pass.matched, true, 'Rule should match when all typed conditions pass');
    assert.equal(pass.failedConditions.length, 0);

    const fail = svc.evaluateRuleConditions(cond, {
      transactionType: 'Expense',
      amount: 250,
      counterparty: 'Coffee Shop',
      withinDays: 10,
    });
    assert.equal(fail.matched, false);
    assert.equal(fail.failedConditions.length, 3);
    console.log('✓ Test 4 passed: Rule condition evaluator handles typed predicates and detailed diagnostics cleanly.');
  }

  // 5. Encrypted Offline Outbox: Web Crypto AES-GCM roundtrip, backoff, logout preservation, and explicit discard
  {
    const mem = setupMemoryStorage();
    const userScope = 'user-test-scope-42';
    const samplePayload = {
      idempotencyKey: 'idemp-test-1',
      amount: 185.5,
      type: 'Expense',
      category: 'Dining',
      notes: 'Confidential merchant note',
    };

    const encrypted = await encryptPayloadForUser(userScope, samplePayload);
    assert.ok(!encrypted.cipherB64.includes('Confidential'), 'Encrypted ciphertext must not contain plaintext strings');
    const decrypted = await decryptPayloadForUser(userScope, encrypted.ivB64, encrypted.cipherB64);
    assert.deepEqual(decrypted, samplePayload, 'Decrypted payload must match original object');

    await assert.rejects(
      () => decryptPayloadForUser('different-user-scope', encrypted.ivB64, encrypted.cipherB64),
      /decrypt|operation|error|tag/i,
      'Decrypting under another user scope must fail'
    );

    const queued = await enqueueOfflineTransaction(samplePayload, userScope);
    assert.equal(queued.status, 'pending_sync');
    assert.equal(queued.idempotencyKey, 'idemp-test-1');
    const loadedBeforeLogout = await loadDecryptedOfflineOutbox(userScope);
    assert.equal(loadedBeforeLogout.length, 1);
    assert.equal(loadedBeforeLogout[0].payload.notes, 'Confidential merchant note');

    // Verify clearOfflineFinancialCachesOnLogout NEVER destroys pending offline outbox records
    mem.set('truespend_last_user_scope', userScope);
    mem.set('truespend_auth_token', 'fake-jwt');
    const logoutResult = clearOfflineFinancialCachesOnLogout();
    assert.ok(logoutResult.preservedPendingCount >= 1, 'Pending encrypted outbox must be preserved on logout');

    const loadedAfterLogout = await loadDecryptedOfflineOutbox(userScope);
    assert.equal(loadedAfterLogout.length, 1, 'Pending outbox items must survive logout safely');

    // Explicit discard guard
    assert.throws(() => forceDiscardOfflineOutbox(false, userScope), /Explicit user confirmation required/);
    forceDiscardOfflineOutbox(true, userScope);
    const loadedAfterDiscard = await loadDecryptedOfflineOutbox(userScope);
    assert.equal(loadedAfterDiscard.length, 0);

    // Exponential backoff bounded check
    assert.equal(calculateBackoffMs(0), 5000);
    assert.equal(calculateBackoffMs(1), 10000);
    assert.ok(calculateBackoffMs(20) <= 30 * 60 * 1000, 'Backoff must be bounded to <= 30 minutes');
    console.log('✓ Test 5 passed: Offline outbox uses AES-GCM encryption, preserves pending items on logout, and bounds retry backoff.');
  }

  console.log('\nAll Core Financial Invariant tests passed!');
}

runTests().catch((err) => {
  console.error('Core financial invariant test failure:', err);
  process.exit(1);
});
