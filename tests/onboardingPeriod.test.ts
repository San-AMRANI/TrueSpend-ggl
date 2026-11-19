import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import {
  computeOnboardingPeriodDates,
  computeOnboardingPreviewMetrics,
  validateOnboardingSetup,
} from '../src/lib/onboardingPeriod.js';
import { ensureDatabaseSchema, db } from '../src/db/index.js';
import { users, categoryBudgets } from '../src/db/schema.js';
import { onboardingService } from '../server/services/OnboardingService.js';
import { kpiService } from '../server/services/KpiService.js';
import { templateService } from '../server/services/TemplateService.js';
import { walletService } from '../server/services/WalletService.js';
import { payrollRepository } from '../server/repositories/PayrollRepository.js';
import { getCurrentFinancialMonth } from '../src/lib/financialMonth.js';
import { eq } from 'drizzle-orm';

test('computeOnboardingPeriodDates handles mid-cycle payday_to_payday before and after payday', () => {
  const beforePayday = computeOnboardingPeriodDates({
    employmentType: 'employee',
    financialCycleMode: 'payday_to_payday',
    startingPoint: 'mid_cycle',
    paydayDay: 25,
    now: new Date(2026, 10, 18, 10, 0, 0), // Nov 18, 2026
  });
  assert.equal(beforePayday.periodStartDate, '2026-10-25');
  assert.equal(beforePayday.periodEndDate, '2026-11-24');
  assert.equal(beforePayday.nextPaydayDate, '2026-11-25');
  assert.equal(beforePayday.daysRemaining, 7);
  assert.equal(beforePayday.totalDays, 31);

  const afterPayday = computeOnboardingPeriodDates({
    employmentType: 'employee',
    financialCycleMode: 'payday_to_payday',
    startingPoint: 'mid_cycle',
    paydayDay: 25,
    now: new Date(2026, 10, 28, 10, 0, 0), // Nov 28, 2026
  });
  assert.equal(afterPayday.periodStartDate, '2026-11-25');
  assert.equal(afterPayday.periodEndDate, '2026-12-24');
  assert.equal(afterPayday.nextPaydayDate, '2026-12-25');
  assert.equal(afterPayday.daysRemaining, 27);
});

test('computeOnboardingPeriodDates handles first_day start, February day-31 clamping, calendar_month, and custom_period', () => {
  const firstDayOnPayday = computeOnboardingPeriodDates({
    employmentType: 'employee',
    financialCycleMode: 'payday_to_payday',
    startingPoint: 'first_day',
    paydayDay: 31,
    now: new Date(2026, 0, 31, 9, 0, 0), // Jan 31, 2026
  });
  assert.equal(firstDayOnPayday.periodStartDate, '2026-01-31');
  assert.equal(firstDayOnPayday.nextPaydayDate, '2026-02-28');
  assert.equal(firstDayOnPayday.periodEndDate, '2026-02-27');

  const calMonth = computeOnboardingPeriodDates({
    employmentType: 'non_employee',
    financialCycleMode: 'calendar_month',
    startingPoint: 'mid_cycle',
    paydayDay: 1,
    now: new Date(2026, 10, 18, 9, 0, 0),
  });
  assert.equal(calMonth.periodStartDate, '2026-11-01');
  assert.equal(calMonth.periodEndDate, '2026-11-30');
  assert.equal(calMonth.nextPaydayDate, '2026-12-01');
  assert.equal(calMonth.daysRemaining, 13);

  const customPeriod = computeOnboardingPeriodDates({
    employmentType: 'employee',
    financialCycleMode: 'custom_period',
    startingPoint: 'mid_cycle',
    paydayDay: 26,
    customStartDate: '2026-11-10',
    customNextPaydayDate: '2026-12-05',
    now: new Date(2026, 10, 18, 9, 0, 0),
  });
  assert.equal(customPeriod.periodStartDate, '2026-11-10');
  assert.equal(customPeriod.nextPaydayDate, '2026-12-05');
  assert.equal(customPeriod.periodEndDate, '2026-12-04');
  assert.equal(customPeriod.daysRemaining, 17);
});

test('validateOnboardingSetup enforces mandatory employee salary and valid dates', () => {
  const now = new Date(2026, 10, 18, 9, 0, 0);

  const missingEmployeeSalary = validateOnboardingSetup(
    {
      employmentType: 'employee',
      financialCycleMode: 'payday_to_payday',
      startingPoint: 'mid_cycle',
      paydayDay: 25,
      salary: 0,
      periodStartDate: '2026-10-25',
      nextPaydayDate: '2026-11-25',
    },
    now
  );
  assert.equal(missingEmployeeSalary.valid, false);

  const nonEmployeeZeroSalary = validateOnboardingSetup(
    {
      employmentType: 'non_employee',
      financialCycleMode: 'calendar_month',
      startingPoint: 'mid_cycle',
      paydayDay: 1,
      salary: 0,
      periodStartDate: '2026-11-01',
      nextPaydayDate: '2026-12-01',
    },
    now
  );
  assert.equal(nonEmployeeZeroSalary.valid, true);

  const invertedDates = validateOnboardingSetup(
    {
      employmentType: 'employee',
      financialCycleMode: 'custom_period',
      startingPoint: 'first_day',
      paydayDay: 25,
      salary: 10000,
      periodStartDate: '2026-11-18',
      nextPaydayDate: '2026-11-18',
    },
    now
  );
  assert.equal(invertedDates.valid, false);
});

test('computeOnboardingPreviewMetrics divides spendable cash cleanly across remaining days', () => {
  const preview = computeOnboardingPreviewMetrics({
    accounts: [
      { name: 'Main Bank', type: 'Bank', openingBalance: 2600, isMain: true },
      { name: 'Cash Wallet', type: 'Cash', openingBalance: 400, isMain: false },
    ],
    emergencyBuffer: 200,
    daysRemaining: 7,
  });

  assert.equal(preview.totalOpeningCash, 3000);
  assert.equal(preview.protectedReserve, 200);
  assert.equal(preview.spendableCash, 2800);
  assert.equal(preview.dailyAllowance, 400);
});

test('OnboardingService + KpiService + TemplateService calibrate active financial period end-to-end', async () => {
  await ensureDatabaseSchema();

  const suffix = crypto.randomUUID().slice(0, 8);
  const [createdUser] = await db
    .insert(users)
    .values({
      uid: `test_onboard_${suffix}`,
      username: `onboard_${suffix}`,
      displayName: 'Test Employee',
      email: `onboard_${suffix}@example.com`,
      emailVerifiedAt: new Date(),
      status: 'active',
      experienceTier: 'basic',
    })
    .returning();

  // Simulate background dashboard boot calling getWallets before Step 5 runs
  const autoSeeded = await walletService.getWallets(createdUser.id);
  assert.equal(autoSeeded.length, 2);

  // Attempting to complete before mandatory setup must fail
  await assert.rejects(
    () => onboardingService.updateOnboardingState(createdUser.id, { action: 'complete' }),
    /mandatory/i
  );

  // Configure mid-cycle employee period anchored 10 days ago to 7 days from today
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startDt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);
  const nextDt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  await onboardingService.setupFinancialPeriod(createdUser.id, {
    employmentType: 'employee',
    financialCycleMode: 'custom_period',
    startingPoint: 'mid_cycle',
    paydayDay: nextDt.getDate(),
    salary: 12000,
    periodStartDate: toIso(startDt),
    nextPaydayDate: toIso(nextDt),
    emergencyBuffer: 200,
  });

  const accountsRes = await onboardingService.setupOpeningAccounts(
    createdUser.id,
    [
      { name: 'Main Bank', type: 'Bank', openingBalance: 2600, isMain: true, currency: 'MAD' },
      { name: 'Cash Wallet', type: 'Cash', openingBalance: 400, isMain: false, currency: 'MAD' },
    ],
    { emergencyBuffer: 200 }
  );

  const finalWallets = await walletService.getWallets(createdUser.id);
  assert.equal(finalWallets.length, 2, 'Auto-seeded Bank Account should be repurposed, not duplicated');
  assert.deepEqual(
    finalWallets.map((w) => w.name).sort(),
    ['Cash Wallet', 'Main Bank']
  );
  assert.equal(accountsRes.accounts.find((w) => w.name === 'Main Bank')?.isMain, true);

  const completedState = await onboardingService.updateOnboardingState(createdUser.id, {
    action: 'complete',
    stepId: 'completed_wizard',
  });
  assert.ok(completedState.onboardingCompletedAt);
  assert.equal(completedState.profileSnapshot?.hasActivePeriod, true);
  assert.equal(completedState.profileSnapshot?.hasWallets, true);
  assert.equal(completedState.profileSnapshot?.employmentType, 'employee');
  assert.equal(completedState.profileSnapshot?.startingPoint, 'mid_cycle');

  // Applying a starter template aligns budgets with the calibrated financial period year/month
  // and must preserve the user's explicit Step 5 emergencyBuffer (200, not template default 1000)
  await templateService.applyTemplate(createdUser.id, 'basic', 'basic-payday-budget');
  const seededBudgets = await db
    .select()
    .from(categoryBudgets)
    .where(eq(categoryBudgets.userId, createdUser.id));
  const userPayrolls = await payrollRepository.findAllByUserId(createdUser.id);
  const currentFm = getCurrentFinancialMonth(userPayrolls);
  assert.ok(currentFm, 'Active financial month must resolve from onboarding payrolls');
  assert.ok(seededBudgets.length > 0);
  for (const b of seededBudgets) {
    assert.equal(b.year, currentFm!.year);
    assert.equal(b.month, currentFm!.month);
  }

  const [freshUser] = await db.select().from(users).where(eq(users.id, createdUser.id)).limit(1);
  const kpis = await kpiService.getKpisForUser(freshUser);
  assert.equal(kpis.financialMonthReady, true);
  assert.equal(kpis.bankBalance, 2600);
  assert.equal(kpis.cashOnHand, 400);
  assert.equal(kpis.totalLiquidity, 3000);
  assert.equal(kpis.emergencyBuffer, 200);
  assert.equal(kpis.safeToSpend, 2800);
  assert.equal(kpis.daysUntilPayday, 7);
  assert.equal(kpis.dailyAllowance, 400);
  assert.equal(kpis.monthlyIncome, 0, 'Opening balances must never create fake income');
  assert.equal(kpis.salary, 12000);
});
