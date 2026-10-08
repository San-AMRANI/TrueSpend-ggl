import assert from 'node:assert/strict';
import { evaluatePurchaseDecision } from '../src/lib/decisionEngine.js';
import { compareScenarios } from '../src/lib/scenarioPlanning.js';
import { analyzeForecastAccuracy } from '../src/lib/forecastAccuracy.js';
import { evaluateFinancialRules } from '../src/lib/rulesEngine.js';

const now = new Date('2026-09-15T12:00:00Z');
const settings = { emergencyBuffer: 100, salary: 3000 };

const payrolls = [
  { id: 'pay-1', userId: 'user', scheduledFor: '2026-08-25T00:00:00Z', amount: '3000', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'pay-2', userId: 'user', scheduledFor: '2026-09-25T00:00:00Z', amount: '3000', createdAt: '2026-08-01T00:00:00Z' },
];

const input = {
  now,
  transactions: [
    { id: 'income', userId: 'user', createdAt: '2026-08-26T00:00:00Z', amount: '3000', type: 'Income' as any, sourceWallet: 'Bank', category: 'Income' }
  ],
  payrolls,
  debts: [],
  budgets: [],
  userSettings: settings,
};

// 1. Decision Engine
{
  const goals = [{
    id: 'goal-1',
    userId: 'user',
    name: 'Laptop',
    targetAmount: '12000',
    currentAmount: '6000',
    category: 'Electronics',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }];
  
  const result = evaluatePurchaseDecision(input, goals, { amount: 2500, category: 'Electronics' });
  assert.equal(result.isAffordable, true);
  assert.ok(result.message.includes('Affordable today'));
}

// 2. Scenario Planning
{
  const scenarios = [
    {
      name: 'Buy Phone',
      additionalTransactions: [
        { id: 'expense-1', userId: 'user', createdAt: '2026-09-15T00:00:00Z', amount: '3000', type: 'Expense' as any, sourceWallet: 'Bank', category: 'Electronics' }
      ]
    }
  ];
  
  const result = compareScenarios(input, scenarios);
  assert.equal(result.base.name, 'Baseline');
  assert.equal(result.scenarios[0].name, 'Buy Phone');
  assert.ok(result.base.safeToSpend > result.scenarios[0].safeToSpend);
}

// 3. Forecast Accuracy
{
  const record = {
    periodId: 'aug-sep-2026',
    expectedEopBalance: 3400,
    actualEopBalance: 3180,
    recordedAt: now
  };
  const result = analyzeForecastAccuracy(record);
  assert.equal(result.error, -220);
  assert.ok(result.message.includes('Forecast over-estimated by 220'));
}

// 4. Rules Engine
{
  const events = [
    { type: 'BUDGET_EXCEEDED' as any, payload: { category: 'Food', usedPercent: 85 } },
    { type: 'SALARY_RECEIVED' as any, payload: {} }
  ];
  const actions = evaluateFinancialRules(input, events);
  assert.equal(actions.length, 2);
  assert.ok(actions[0].includes('Notify: Budget for Food is 85% used.'));
  assert.ok(actions[1].includes('Generate paycheck allocation proposal'));
}

console.log('decisionIntelligence tests passed');
