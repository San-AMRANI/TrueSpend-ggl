import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequiredSlicesForTab,
  mergeTransactionsSlice,
  sliceTransactionsWindow,
} from '../src/lib/bootstrapScopes.js';
import {
  computeNextProgressiveCount,
  shouldHydrateImmediately,
} from '../src/components/ui/ProgressiveSection.js';
import {
  SPEX_SPRITESHEET_PNG,
  SPEX_SPRITESHEET_WEBP,
  computeSpriteFrameCoords,
  resolveSpritesheetUrl,
} from '../src/components/common/SpexSprite.js';
import {
  computeDailyDisciplineStreak,
  computeMacroBenchmark,
} from '../src/components/dashboard/overview/overviewHelpers.js';
import type { KPI, Payroll, Transaction } from '../src/types/index.js';

function makeTx(id: string, daysAgo: number, amount = '100', type: Transaction['type'] = 'Expense', category = '🛒 Groceries'): Transaction {
  const createdAt = new Date(Date.UTC(2026, 10, 17, 12, 0, 0) - daysAgo * 86_400_000).toISOString();
  return {
    id,
    userId: 'user-1',
    type,
    amount,
    category,
    notes: `Tx ${id}`,
    createdAt,
  };
}

describe('Split-Boot Scopes & Transaction Windowing', () => {
  it('returns non-partial window when total transactions <= minRows', () => {
    const txs = Array.from({ length: 40 }, (_, i) => makeTx(`t-${i}`, i));
    const { transactions, meta } = sliceTransactionsWindow(txs, {
      windowDays: 120,
      minRows: 150,
      nowMs: Date.UTC(2026, 10, 17, 12, 0, 0),
    });

    assert.equal(transactions.length, 40);
    assert.equal(meta.isPartial, false);
    assert.equal(meta.totalCount, 40);
    assert.equal(meta.loadedCount, 40);
  });

  it('slices large ledgers to windowDays + minRows without dropping active cycle history', () => {
    const nowMs = Date.UTC(2026, 10, 17, 12, 0, 0);
    const txs = Array.from({ length: 320 }, (_, i) => makeTx(`t-${i}`, i));
    const { transactions, meta } = sliceTransactionsWindow(txs, {
      windowDays: 120,
      minRows: 150,
      nowMs,
    });

    assert.equal(meta.isPartial, true);
    assert.equal(meta.totalCount, 320);
    assert.equal(transactions.length, 150);
    assert.equal(transactions[0].id, 't-0');
    assert.equal(transactions[149].id, 't-149');
  });

  it('preserves archived history when a partial core refresh arrives', () => {
    const olderArchived = makeTx('old-200', 220);
    const existingRecent = makeTx('recent-1', 1, '80');
    const refreshedRecent = makeTx('recent-1', 1, '95');
    const brandNew = makeTx('recent-0', 0, '50');

    const mergedPartial = mergeTransactionsSlice(
      [existingRecent, olderArchived],
      [brandNew, refreshedRecent],
      true,
    );

    assert.equal(mergedPartial.length, 3);
    assert.equal(mergedPartial[0].id, 'recent-0');
    assert.equal(mergedPartial.find((t) => t.id === 'recent-1')?.amount, '95');
    assert.equal(mergedPartial.find((t) => t.id === 'old-200')?.id, 'old-200');

    const replacedFull = mergeTransactionsSlice([existingRecent, olderArchived], [brandNew], false);
    assert.equal(replacedFull.length, 1);
    assert.equal(replacedFull[0].id, 'recent-0');
  });

  it('computes on-demand tab hydration requirements cleanly', () => {
    assert.deepEqual(
      getRequiredSlicesForTab('overview', {
        hasFullHistory: false,
        hasContexts: false,
        hasInvestments: false,
        isAdvanced: true,
      }),
      { needHistory: false, needInvestments: false },
    );

    assert.deepEqual(
      getRequiredSlicesForTab('transactions', {
        hasFullHistory: false,
        hasContexts: false,
        hasInvestments: false,
        isAdvanced: true,
      }),
      { needHistory: true, needInvestments: false },
    );

    assert.deepEqual(
      getRequiredSlicesForTab('investments', {
        hasFullHistory: true,
        hasContexts: false,
        hasInvestments: false,
        isAdvanced: true,
      }),
      { needHistory: false, needInvestments: true },
    );

    assert.deepEqual(
      getRequiredSlicesForTab('investments', {
        hasFullHistory: false,
        hasContexts: false,
        hasInvestments: false,
        isAdvanced: false,
      }),
      { needHistory: false, needInvestments: false },
    );
  });
});

describe('True Viewport Partial Loading Helpers', () => {
  it('never eagerly hydrates below-the-fold sections unless IntersectionObserver is unavailable or priorityDelayMs===0', () => {
    assert.equal(
      shouldHydrateImmediately({
        hasWindow: true,
        hasIntersectionObserver: true,
        hydrateOnIdle: false,
        priorityDelayMs: 0,
      }),
      false,
    );

    assert.equal(
      shouldHydrateImmediately({
        hasWindow: true,
        hasIntersectionObserver: true,
        hydrateOnIdle: true,
        priorityDelayMs: 120,
      }),
      false,
    );

    assert.equal(
      shouldHydrateImmediately({
        hasWindow: true,
        hasIntersectionObserver: true,
        hydrateOnIdle: true,
        priorityDelayMs: 0,
      }),
      true,
    );

    assert.equal(
      shouldHydrateImmediately({
        hasWindow: true,
        hasIntersectionObserver: false,
        hydrateOnIdle: false,
        priorityDelayMs: 120,
      }),
      true,
    );
  });

  it('computes bounded progressive list increments without exceeding total', () => {
    assert.equal(computeNextProgressiveCount(24, 100, 36), 60);
    assert.equal(computeNextProgressiveCount(80, 100, 36), 100);
    assert.equal(computeNextProgressiveCount(0, 10, 0), 1);
  });
});

describe('SPEX Sprite Coordinate & Format Selection', () => {
  it('selects single WebP vs PNG spritesheet URL instead of dual-loading both', () => {
    assert.equal(resolveSpritesheetUrl(true), SPEX_SPRITESHEET_WEBP);
    assert.equal(resolveSpritesheetUrl(false), SPEX_SPRITESHEET_PNG);
  });

  it('computes 8x11 grid background-position percentages cleanly for animation and look sectors', () => {
    const idleFrame3 = computeSpriteFrameCoords({
      effectiveState: 'idle',
      lookAtCursor: true,
      isPointerLooking: false,
      hasTransientState: false,
      forcedLookSector: null,
      forcedFrame: null,
      frameIndex: 3,
      activeLookSector: 0,
    });
    assert.equal(idleFrame3.shouldUseLookCell, false);
    assert.equal(idleFrame3.row, 0);
    assert.equal(idleFrame3.col, 3);
    assert.equal(idleFrame3.bgPosY, '0%');

    const lookSector12 = computeSpriteFrameCoords({
      effectiveState: 'idle',
      lookAtCursor: true,
      isPointerLooking: true,
      hasTransientState: false,
      forcedLookSector: null,
      forcedFrame: null,
      frameIndex: 0,
      activeLookSector: 12,
    });
    assert.equal(lookSector12.shouldUseLookCell, true);
    assert.equal(lookSector12.row, 10);
    assert.equal(lookSector12.col, 4);
    assert.equal(lookSector12.bgPosY, '100%');
  });
});

describe('Overview Frame-1 & Band Helpers', () => {
  it('computes 30-day discipline streak in O(30d) without full-history traversal', () => {
    const nowMs = Date.UTC(2026, 10, 17, 12, 0, 0);
    const txs: Transaction[] = [
      { ...makeTx('today', 0, '100'), createdAt: new Date(nowMs - 3600_000).toISOString() },
      { ...makeTx('yest', 1, '150'), createdAt: new Date(nowMs - 86_400_000).toISOString() },
      { ...makeTx('breach', 2, '500'), createdAt: new Date(nowMs - 2 * 86_400_000).toISOString() },
      { ...makeTx('ancient', 45, '9999'), createdAt: new Date(nowMs - 45 * 86_400_000).toISOString() },
    ];

    const stats = computeDailyDisciplineStreak(txs, 200, nowMs);
    assert.equal(stats.streakDays, 2);
    assert.equal(stats.daysUnderIn30d, 29);
  });

  it('computes 50/30/20 macro benchmark summing to 100%', () => {
    const payrolls: Payroll[] = [
      {
        id: 'p1',
        userId: 'user-1',
        amount: '10000',
        scheduledFor: '2026-11-01',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: 'user-1',
        amount: '10000',
        scheduledFor: '2026-12-01',
        createdAt: '2026-12-01T00:00:00.000Z',
      },
    ];
    const txs: Transaction[] = [
      {
        id: 'n1',
        userId: 'user-1',
        type: 'Expense',
        amount: '3000',
        category: '🛒 Groceries',
        createdAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 'w1',
        userId: 'user-1',
        type: 'Expense',
        amount: '2000',
        category: '🍽️ Dining & Coffee',
        createdAt: '2026-11-06T10:00:00.000Z',
      },
    ];
    const kpi = {
      monthlyIncome: 10000,
      monthlyExpenses: 5000,
    } as KPI;

    const macro = computeMacroBenchmark(
      txs,
      kpi,
      {
        year: 2026,
        month: 11,
        start: new Date('2026-11-01T00:00:00.000Z'),
        end: new Date('2026-12-01T00:00:00.000Z'),
        startPayroll: payrolls[0],
        endPayroll: payrolls[1],
      },
      payrolls,
    );

    assert.equal(macro.needsPct, 30);
    assert.equal(macro.wantsPct, 20);
    assert.equal(macro.savingsPct, 50);
  });
});
