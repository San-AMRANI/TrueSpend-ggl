import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAiContextSnapshot } from '../src/lib/aiContext.js';
import { compactLiveContext } from '../src/lib/liveVoiceHelpers.js';
import { sanitizeAiActions } from '../server/services/AiActionGateway.js';
import { buildLiveVoiceSystemInstruction } from '../server/services/LiveVoiceGateway.js';

const sampleKpis: any = {
  safeToSpend: 4200,
  totalLiquidity: 11500,
  liquidCash: 10000,
  savingsTotal: 1500,
  emergencyBuffer: 2500,
  daysUntilPayday: 14,
  dailyAllowance: 300,
  paydayDayOfMonth: 25,
  expectedIncome: 12000,
  monthlyExpenses: 4800,
  creditCardLiabilities: 1200,
  upcomingSubscriptions: 650,
  totalPayableDebt: 1500,
  totalReceivableDebt: 400,
  pendingPayrollsTotal: 12000,
  accounts: [
    {
      id: 'w_bank',
      name: 'CIH Checking',
      type: 'bank',
      accountSubtype: 'checking',
      institutionName: 'CIH Bank',
      currency: 'MAD',
      balance: 10000,
      includeInSafeToSpend: true,
      includeInNetWorth: true,
    },
    {
      id: 'w_cc',
      name: 'BMCE Visa Gold',
      type: 'credit_card',
      accountSubtype: 'credit_card',
      institutionName: 'BMCE',
      currency: 'MAD',
      balance: -1200,
      creditLimit: 10000,
      statementClosingDay: 20,
      paymentDueDay: 5,
      minimumPayment: 300,
      includeInSafeToSpend: false,
      includeInNetWorth: true,
    },
    {
      id: 'w_save',
      name: 'Emergency Vault',
      type: 'savings',
      accountSubtype: 'savings',
      currency: 'MAD',
      balance: 1500,
      includeInSafeToSpend: false,
      includeInNetWorth: true,
    },
  ],
};

const sampleTransactions: any[] = [
  {
    id: 'tx_1',
    type: 'Expense',
    amount: '350',
    category: 'Groceries',
    notes: 'Marjane Market',
    createdAt: new Date().toISOString(),
    walletId: 'w_bank',
    currency: 'MAD',
    isPartialPayment: false,
  },
  {
    id: 'tx_2',
    type: 'Expense',
    amount: '450',
    category: 'Dining',
    notes: 'Marjane Market',
    createdAt: new Date().toISOString(),
    walletId: 'w_bank',
    currency: 'MAD',
    splits: [{ id: 'sp_1', participant: 'Youssef', amount: 150, status: 'pending' }],
  },
];

const sampleOperationalRadar: any = {
  upcomingCommitments: [
    {
      id: 'comm_1',
      title: 'Lydec Water & Electricity',
      amount: 320,
      dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      sourceType: 'subscription',
      status: 'upcoming',
      isVariableAmount: true,
    },
  ],
  pendingReviews: [
    {
      id: 'rev_1',
      type: 'stale_valuation',
      severity: 'warning',
      title: 'Refresh Dacia Duster valuation',
      description: 'Not updated in 120 days',
    },
  ],
  integritySummary: {
    healthy: true,
    issueCount: 1,
    checkedAt: new Date().toISOString(),
    issues: [{ code: 'STALE_ASSET', severity: 'warning', message: '1 stale external asset' }],
  },
  externalWealthSummary: {
    items: [
      {
        id: 'ext_1',
        name: 'Dacia Duster 2022',
        kind: 'asset',
        category: 'vehicle',
        currentValueMad: 165000,
        purchasePriceMad: 195000,
        valuationStatus: 'stale',
        lastValuedAt: '2025-10-01T00:00:00.000Z',
        includeInNetWorth: true,
        isIlliquid: true,
      },
      {
        id: 'ext_2',
        name: 'Auto Financing Balance',
        kind: 'liability',
        category: 'auto_loan',
        currentValueMad: 45000,
        valuationStatus: 'fresh',
        includeInNetWorth: true,
      },
    ],
    totalExternalAssetsMad: 165000,
    totalExternalLiabilitiesMad: 45000,
    netExternalWealthMad: 120000,
    staleCount: 1,
  },
};

test('buildAiContextSnapshot builds full 360° snapshot with external wealth, radar, credit cards, and user profile', () => {
  const snapshot: any = buildAiContextSnapshot({
    kpis: sampleKpis,
    transactions: sampleTransactions,
    debts: [
      {
        id: 'debt_1',
        contact: 'Bank Auto Loan',
        counterpartyType: 'institution',
        type: 'payable',
        amount: '1500',
        remainingBalance: '1500',
        currency: 'MAD',
        interestRateApr: 5.2,
        installmentAmount: 500,
        installmentFrequency: 'monthly',
        feesAmount: 50,
        forgivenAmount: 0,
        dueDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      } as any,
    ],
    budgets: [
      {
        id: 'bud_1',
        category: 'Groceries',
        monthlyLimit: '2000',
        month: '2026-11',
      } as any,
    ],
    payrolls: [
      {
        id: 'pay_1',
        label: 'November Salary',
        expectedAmount: '12000',
        paydayDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        status: 'pending',
        walletId: 'w_bank',
      } as any,
    ],
    goals: [
      {
        id: 'goal_1',
        name: 'Japan Trip',
        targetAmount: '25000',
        currentAmount: '5000',
        fundingCadence: 'monthly',
        plannedContributionAmount: '1000',
      } as any,
    ],
    subscriptions: [
      {
        id: 'sub_1',
        name: 'Lydec Utility',
        amount: '320',
        billingCycle: 'monthly',
        isActive: true,
        walletId: 'w_bank',
        nextBillingDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      } as any,
    ],
    contexts: [
      {
        id: 'ctx_1',
        name: 'Marrakech Weekend',
        status: 'active',
        budgetLimit: '2500',
      } as any,
    ],
    operationalRadar: sampleOperationalRadar,
    userSettings: {
      employmentType: 'salaried',
      financialCycleMode: 'payday_cycle',
      paydayDayOfMonth: 25,
      monthlySalary: 12000,
      baseCurrency: 'MAD',
      emergencyBufferTarget: 2500,
    },
    userProfile: {
      id: 'usr_1',
      displayName: 'Amine',
      experienceTier: 'advanced',
    },
    focusScopes: ['all'],
    responseDepth: 'deep_creative',
  });

  // User profile
  assert.equal(snapshot.userProfile.employmentType, 'salaried');
  assert.equal(snapshot.userProfile.financialCycleMode, 'payday_cycle');
  assert.equal(snapshot.userProfile.experienceTier, 'advanced');

  // Credit card metadata in wallets
  const ccWallet = snapshot.wallets.find((w: any) => w.id === 'w_cc');
  assert.ok(ccWallet);
  assert.equal(ccWallet.creditLimitMad, 10000);
  assert.equal(ccWallet.statementClosingDay, 20);
  assert.equal(ccWallet.paymentDueDay, 5);
  assert.equal(ccWallet.minimumPaymentMad, 300);

  // Payroll ID & status
  assert.equal(snapshot.payrolls[0].id, 'pay_1');
  assert.equal(snapshot.payrolls[0].status, 'pending');
  assert.equal(snapshot.payrolls[0].walletName, 'CIH Checking');

  // Debt APR & fees
  assert.equal(snapshot.debts[0].interestRateApr, 5.2);
  assert.equal(snapshot.debts[0].installmentAmount, 500);
  assert.equal(snapshot.debts[0].feesAmount, 50);

  // External wealth & operational radar
  assert.equal(snapshot.externalWealth.totalExternalAssetsMad, 165000);
  assert.equal(snapshot.externalWealth.totalExternalLiabilitiesMad, 45000);
  assert.equal(snapshot.externalWealth.netExternalWealthMad, 120000);
  assert.equal(snapshot.externalWealth.items.length, 2);
  assert.equal(snapshot.operationalRadar.upcomingCommitments.length, 1);
  assert.equal(snapshot.operationalRadar.pendingReviews.length, 1);

  // Top merchants & behavioral day-of-week patterns
  assert.ok(Array.isArray(snapshot.financialPeriodSummary.topMerchantsByNetSpend));
  assert.ok(snapshot.financialPeriodSummary.topMerchantsByNetSpend.length >= 1);
  assert.ok(Array.isArray(snapshot.predictiveForecast.dayOfWeekSpendingPatterns));
  assert.equal(snapshot.predictiveForecast.dayOfWeekSpendingPatterns.length, 7);

  // Unified net worth distinguishes liquid vs external physical wealth
  assert.equal(snapshot.unifiedNetWorthBreakdown.externalPhysicalAssetsMad, 165000);
  assert.equal(snapshot.unifiedNetWorthBreakdown.externalLiabilitiesMad, 45000);
  assert.equal(snapshot.unifiedNetWorthBreakdown.netExternalWealthMad, 120000);
  assert.ok(
    snapshot.unifiedNetWorthBreakdown.estimatedUnifiedNetWorthMad >
      snapshot.unifiedNetWorthBreakdown.liquidAndInvestmentNetWorthMad,
  );
});

test('buildAiContextSnapshot supports focused assets_radar scope cleanly', () => {
  const snapshot: any = buildAiContextSnapshot({
    kpis: sampleKpis,
    transactions: sampleTransactions,
    debts: [],
    budgets: [],
    payrolls: [],
    operationalRadar: sampleOperationalRadar,
    focusScopes: ['assets_radar'],
  });

  assert.ok(snapshot.externalWealth);
  assert.ok(snapshot.operationalRadar);
  assert.equal(snapshot.externalWealth.netExternalWealthMad, 120000);
  assert.equal(snapshot.operationalRadar.upcomingCommitments.length, 1);
});

test('compactLiveContext respects 32k char budget and preserves priority 360° slices', () => {
  const hugeTx = Array.from({ length: 300 }, (_, i) => ({
    id: `tx_${i}`,
    notes: `Extended Merchant Description #${i} - Casablanca Mall Storefront Receipt Line Items`,
    amount: 120 + i,
  }));
  const payload = {
    userProfile: { employmentType: 'salaried', experienceTier: 'advanced' },
    unifiedNetWorthBreakdown: { estimatedUnifiedNetWorthMad: 130000 },
    externalWealth: { netExternalWealthMad: 120000, items: [{ name: 'Dacia Duster' }] },
    operationalRadar: { upcomingCommitments: [{ title: 'Lydec' }] },
    kpis: { safeToSpend: 4200 },
    currentPeriodTransactions: hugeTx,
    allRecentTransactions: hugeTx,
  };

  const compacted = compactLiveContext(payload, 32_000);
  assert.ok(compacted.length <= 32_000);
  const parsed = JSON.parse(compacted);
  assert.equal(parsed.userProfile.experienceTier, 'advanced');
  assert.equal(parsed.externalWealth.netExternalWealthMad, 120000);
  assert.equal(parsed.operationalRadar.upcomingCommitments[0].title, 'Lydec');
  assert.equal(parsed.unifiedNetWorthBreakdown.estimatedUnifiedNetWorthMad, 130000);
});

test('sanitizeAiActions accepts all 23 TrueSpend AI capabilities and rejects unknown types', () => {
  const all23Types = [
    'create_transaction',
    'create_debt',
    'update_settings',
    'upsert_budget',
    'rollover_budgets',
    'settle_debt',
    'forgive_debt',
    'create_goal',
    'contribute_goal',
    'withdraw_goal',
    'buy_stock',
    'sell_stock',
    'record_dividend',
    'fund_investment_wallet',
    'confirm_payroll',
    'create_payroll',
    'create_subscription',
    'pay_subscription',
    'update_subscription',
    'create_wallet',
    'create_context',
    'declare_external_asset',
    'create_financial_rule',
  ];

  const input = [
    ...all23Types.map((type) => ({
      type,
      summary: `Run ${type}`,
      parameters: { testKey: true },
    })),
    { type: 'delete_entire_database', summary: 'Not allowed', parameters: {} },
  ];

  const sanitized = sanitizeAiActions(input);
  assert.equal(sanitized.length, 23);
  assert.deepEqual(
    sanitized.map((a) => a.type),
    all23Types,
  );

  // Also test flat parameter normalization
  const flatSanitized = sanitizeAiActions([
    { type: 'declare_external_asset', summary: 'Declare gold', name: 'Gold Ring', currentValueMad: 4500 },
  ]);
  assert.equal(flatSanitized.length, 1);
  assert.equal(flatSanitized[0].parameters.name, 'Gold Ring');
  assert.equal(flatSanitized[0].parameters.currentValueMad, 4500);
});

test('buildLiveVoiceSystemInstruction embeds 360° domains including External Wealth and Operational Radar', () => {
  const prompt = buildLiveVoiceSystemInstruction(
    {
      userProfile: { employmentType: 'salaried' },
      externalWealth: { netExternalWealthMad: 120000 },
      operationalRadar: { upcomingCommitments: [{ title: 'Lydec' }] },
    },
    ['all'],
  );

  assert.ok(prompt.includes('externalWealth'));
  assert.ok(prompt.includes('operationalRadar'));
  assert.ok(prompt.includes('credit card'));
  assert.ok(prompt.includes('Total Unified Net Worth'));
  assert.ok(prompt.includes('120000'));
});

test('LiveVoiceSessionModal uses icon-only buttons without Mute Mic / Stop / End Live / End Call text', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/chat/LiveVoiceSessionModal.tsx');
  const source = fs.readFileSync(modalPath, 'utf8');

  assert.equal(source.includes('Mute Mic'), false, 'Should not contain "Mute Mic" text');
  assert.equal(source.includes('Unmute Mic'), false, 'Should not contain "Unmute Mic" text');
  assert.equal(source.includes('End Live'), false, 'Should not contain "End Live" text');
  assert.equal(source.includes('End Call'), false, 'Should not contain "End Call" text');
  assert.equal(source.includes('Reconnect Live Session'), false, 'Should not contain "Reconnect Live Session" text');
  assert.equal(source.includes('>Stop<'), false, 'Should not contain visible "Stop" button label');
  assert.ok(source.includes('data-testid="live-voice-controls"'), 'Should include testid for icon dock');
  assert.ok(source.includes("aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}"));
  assert.ok(source.includes('aria-label="End live voice session"'));
});
