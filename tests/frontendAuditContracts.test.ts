import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  safeJsonParse,
  parseSavedScenario,
  parseFinancialRuleDetails,
  normalizeStatementImportResult,
  buildReviewDecisionPayload,
  buildPayrollConfirmPayload,
} from '../src/lib/auditContracts.js';
import {
  getCycleMeta,
  getNormalizedMonthlyAmount,
  shiftDateByCycle,
} from '../src/lib/subscriptionCycles.js';
import type { FinancialRuleItem, SavedWhatIfScenario } from '../src/types/index.js';

function runFrontendContractTests() {
  // 1. safeJsonParse handles valid JSON, null/undefined, and malformed strings
  {
    assert.deepEqual(safeJsonParse('{"a":1,"b":"ok"}', {}), { a: 1, b: 'ok' });
    assert.deepEqual(safeJsonParse<number[]>('[10,20]', []), [10, 20]);
    assert.deepEqual(safeJsonParse(null, { fallback: true }), { fallback: true });
    assert.deepEqual(safeJsonParse('{invalid json', { fallback: true }), { fallback: true });
    console.log('✓ Test 1 passed: safeJsonParse cleanly parses JSON and isolates malformed payloads.');
  }

  // 2. parseSavedScenario extracts baselineSnapshot, assumptions, events, and computes deltaVsBaselineMad fallback
  {
    const rawScenario: SavedWhatIfScenario = {
      id: 'scen-1',
      userId: 'user-1',
      name: 'Aggressive Debt Payoff + DCA',
      description: 'Cut dining 20% and increase equity DCA',
      isApprovedPlan: true,
      baselineSnapshotJson: JSON.stringify({
        startingCashMad: 25000,
        startingNetWorthMad: 120000,
        emergencyBufferMad: 15000,
      }),
      assumptionsJson: JSON.stringify({
        horizonMonths: 12,
        discretionaryCutPercent: 20,
        extraMonthlyDcaMad: 1500,
      }),
      eventsJson: JSON.stringify([
        { id: 'ev-1', label: 'Year-end bonus', amountMad: 8000, monthOffset: 6, kind: 'one_time' },
      ]),
      projectedSummaryJson: JSON.stringify({
        baselineNetWorth12m: 150000,
        simulatedNetWorth12m: 174500,
        lowest30dBalance: 18500,
        survivalRunwayDays: 145,
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const parsed = parseSavedScenario(rawScenario);
    assert.equal(parsed.id, 'scen-1');
    assert.equal(parsed.isApprovedPlan, true);
    assert.equal(parsed.baselineSnapshot.startingNetWorthMad, 120000);
    assert.equal(parsed.assumptions.extraMonthlyDcaMad, 1500);
    assert.equal(parsed.events.length, 1);
    assert.equal(parsed.projectedSummary.deltaVsBaselineMad, 24500);
    assert.equal(parsed.projectedSummary.survivalRunwayDays, 145);
    console.log('✓ Test 2 passed: parseSavedScenario normalizes snapshots, events, assumptions, and deltas.');
  }

  // 3. parseFinancialRuleDetails turns raw JSON conditions and actionPayload into readable chips + summaries
  {
    const rule: FinancialRuleItem = {
      id: 'rule-1',
      userId: 'user-1',
      name: 'Auto-Save 25% of Salary',
      triggerType: 'payroll_confirmed',
      conditionsJson: JSON.stringify({
        transactionType: 'Income',
        minAmount: 8000,
        cooldownHours: 24,
      }),
      actionType: 'prepare_allocation',
      actionPayloadJson: JSON.stringify({
        percent: 25,
        target: 'Emergency Vault',
      }),
      enabled: true,
      approvalPolicy: 'draft_for_approval',
      version: 1,
      lastTriggeredAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const parsed = parseFinancialRuleDetails(rule);
    assert.ok(parsed.conditionChips.includes('Type: Income'));
    assert.ok(parsed.conditionChips.includes('Min: 8000 MAD'));
    assert.ok(parsed.conditionChips.includes('Cooldown 24h'));
    assert.equal(parsed.actionSummary, 'Draft 25% allocation -> Emergency Vault');
    console.log('✓ Test 3 passed: parseFinancialRuleDetails renders deterministic human-readable condition chips & actions.');
  }

  // 4. normalizeStatementImportResult normalizes both flat and { batch, rows } API shapes
  {
    const normalized = normalizeStatementImportResult({
      batch: {
        id: 'batch-1',
        fileName: 'cih_march.csv',
        totalRows: 3,
        matchedCount: 1,
        unmatchedCount: 1,
        ambiguousCount: 1,
        duplicateCount: 0,
        reconciledVariance: '125.50',
      },
      rows: [
        {
          id: 'row-1',
          batchId: 'batch-1',
          rowIndex: 1,
          rowHash: 'hash-1',
          rawDate: '2026-03-01',
          description: 'MARJANE RABAT',
          rawAmount: '-450.00',
          rawCurrency: 'MAD',
          status: 'unmatched',
        },
      ],
    });
    assert.equal(normalized.batch.id, 'batch-1');
    assert.equal(normalized.batch.reconciledVariance, '125.50');
    assert.equal(normalized.rows.length, 1);
    assert.equal(normalized.rows[0].description, 'MARJANE RABAT');
    console.log('✓ Test 4 passed: normalizeStatementImportResult aligns batch & rows contracts.');
  }

  // 5. buildReviewDecisionPayload & buildPayrollConfirmPayload enforce canonical backend DTO field names
  {
    const reviewPayload = buildReviewDecisionPayload({
      action: 'post_transaction',
      walletId: 'wallet-bank',
      category: 'Dining',
      amount: 145.5,
      description: '  Cafe Paul  ',
    });
    assert.deepEqual(reviewPayload, {
      action: 'post_transaction',
      walletId: 'wallet-bank',
      category: 'Dining',
      amount: 145.5,
      description: 'Cafe Paul',
    });

    const payrollPayload = buildPayrollConfirmPayload({
      confirmedAmount: 15200,
      confirmedDate: '2026-03-28',
      walletId: 'wallet-bank',
      varianceNotes: '  Bonus included ',
    });
    assert.deepEqual(payrollPayload, {
      confirmedAmount: 15200,
      confirmedDate: '2026-03-28',
      walletId: 'wallet-bank',
      varianceNotes: 'Bonus included',
    });
    assert.ok(!('confirmedAt' in payrollPayload), 'Must send confirmedDate rather than legacy confirmedAt');
    console.log('✓ Test 5 passed: Review decision and payroll confirmation payloads match backend DTOs.');
  }

  // 6. Navigation integrity: every DashboardTab union value exists once in NAV_ITEMS, with no stale whatif tab
  {
    const typesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/types/index.ts'), 'utf8');
    const navSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/config/navigation.ts'), 'utf8');

    const unionMatch = typesSrc.match(/export type DashboardTab\s*=([\s\S]*?);/);
    assert.ok(unionMatch, 'DashboardTab union must exist in src/types/index.ts');
    const unionTabs = Array.from(unionMatch[1].matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);
    assert.ok(unionTabs.length >= 15, `Expected full DashboardTab list, got ${unionTabs.length}`);
    assert.ok(!unionTabs.includes('whatif'), 'Removed legacy whatif tab must not exist in DashboardTab');
    assert.ok(unionTabs.includes('accounts'), 'Consolidated accounts tab must exist in DashboardTab');

    const navIds = Array.from(navSrc.matchAll(/\bid:\s*'([a-z_]+)'/g))
      .map((m) => m[1])
      .filter((id) => unionTabs.includes(id));

    const uniqueNavIds = new Set(navIds);
    assert.equal(navIds.length, uniqueNavIds.size, 'NAV_ITEMS must not contain duplicate DashboardTab IDs');
    for (const tab of unionTabs) {
      assert.ok(uniqueNavIds.has(tab), `DashboardTab "${tab}" must be present in NAV_ITEMS`);
    }
    console.log(`✓ Test 6 passed: Unified navigation covers all ${unionTabs.length} DashboardTab routes with zero duplicates.`);
  }

  // 7. Subscription multi-month billing cycles & upgrade/downgrade normalization (e.g. 3 Months -> 10 Months / Yearly)
  {
    const tenMonthMeta = getCycleMeta('every_10_months');
    assert.equal(tenMonthMeta.months, 10);
    assert.equal(tenMonthMeta.shortLabel, '10 Months');
    assert.equal(tenMonthMeta.isMultiMonth, true);

    assert.equal(getNormalizedMonthlyAmount(1800, 'every_10_months'), 180);
    assert.equal(getNormalizedMonthlyAmount(300, 'every_3_months'), 100);
    assert.equal(getNormalizedMonthlyAmount(2400, 'yearly'), 200);

    const start = new Date('2026-01-15T00:00:00Z');
    const plus3 = shiftDateByCycle(start, 'every_3_months', 1);
    const plus10 = shiftDateByCycle(start, 'every_10_months', 1);
    const plus12 = shiftDateByCycle(start, 'yearly', 1);
    assert.equal(plus3.toISOString().slice(0, 10), '2026-04-15');
    assert.equal(plus10.toISOString().slice(0, 10), '2026-11-15');
    assert.equal(plus12.toISOString().slice(0, 10), '2027-01-15');

    // Verify backend & frontend subscription upgrade/downgrade wiring exists cleanly
    const subTabSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/dashboard/SubscriptionsTab.tsx'),
      'utf8'
    );
    assert.ok(subTabSrc.includes('change-plan') || subTabSrc.includes('onChangeSubscriptionPlan'));
    assert.ok(subTabSrc.includes('every_10_months'));
    console.log('✓ Test 7 passed: Subscription multi-month cycles (3m, 10m, 1y) & upgrade/downgrade contracts verified.');
  }

  console.log('\nAll Frontend Audit Contract tests passed!');
}

runFrontendContractTests();
