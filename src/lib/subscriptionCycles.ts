import { SubscriptionBillingCycle } from '../types';

export interface CycleMeta {
  id: SubscriptionBillingCycle;
  label: string;
  shortLabel: string;
  badgeLabel: string;
  months: number;
  days: number;
  isMultiMonth: boolean;
}

export const STANDARD_BILLING_CYCLES: CycleMeta[] = [
  {
    id: 'every_3_months',
    label: 'Every 3 Months (3-Month Term)',
    shortLabel: '3 Months',
    badgeLabel: '3-Mo Pass',
    months: 3,
    days: 90,
    isMultiMonth: true,
  },
  {
    id: 'monthly',
    label: 'Every Month (Monthly)',
    shortLabel: 'Monthly',
    badgeLabel: 'Monthly',
    months: 1,
    days: 30,
    isMultiMonth: false,
  },
  {
    id: 'every_2_months',
    label: 'Every 2 Months (2-Month Term)',
    shortLabel: '2 Months',
    badgeLabel: '2-Mo Pass',
    months: 2,
    days: 60,
    isMultiMonth: true,
  },
  {
    id: 'every_6_months',
    label: 'Every 6 Months (6-Month Term)',
    shortLabel: '6 Months',
    badgeLabel: '6-Mo Pass',
    months: 6,
    days: 180,
    isMultiMonth: true,
  },
  {
    id: 'yearly',
    label: 'Every 12 Months (Yearly)',
    shortLabel: 'Yearly',
    badgeLabel: 'Annual',
    months: 12,
    days: 365,
    isMultiMonth: true,
  },
  {
    id: 'weekly',
    label: 'Every Week (7 Days)',
    shortLabel: 'Weekly',
    badgeLabel: 'Weekly',
    months: 12 / 52,
    days: 7,
    isMultiMonth: false,
  },
  {
    id: 'biweekly',
    label: 'Every 2 Weeks (14 Days)',
    shortLabel: '2 Weeks',
    badgeLabel: 'Bi-Weekly',
    months: 24 / 52,
    days: 14,
    isMultiMonth: false,
  },
];

/**
 * Resolves any billingCycle string (including legacy 'quarterly' or custom 'every_N_months' / 'every_N_days')
 * into structured cycle metadata.
 */
export function getCycleMeta(cycle?: string | null): CycleMeta {
  const raw = (cycle || 'monthly').trim().toLowerCase();

  if (raw === 'quarterly' || raw === 'every_3_months' || raw === '3_months' || raw === '3months') {
    return STANDARD_BILLING_CYCLES[0]; // Every 3 Months
  }

  const found = STANDARD_BILLING_CYCLES.find((c) => c.id === raw);
  if (found) return found;

  // Custom every_N_months pattern
  const customMonthsMatch = raw.match(/^every_(\d+)_months?$/);
  if (customMonthsMatch) {
    const n = Math.max(1, parseInt(customMonthsMatch[1], 10));
    return {
      id: `every_${n}_months` as SubscriptionBillingCycle,
      label: n === 1 ? 'Every Month' : `Every ${n} Months (${n}-Month Term)`,
      shortLabel: n === 1 ? 'Monthly' : `${n} Months`,
      badgeLabel: n === 1 ? 'Monthly' : `${n}-Mo Pass`,
      months: n,
      days: n * 30,
      isMultiMonth: n > 1,
    };
  }

  // Custom every_N_days pattern
  const customDaysMatch = raw.match(/^every_(\d+)_days?$/);
  if (customDaysMatch) {
    const d = Math.max(1, parseInt(customDaysMatch[1], 10));
    return {
      id: `every_${d}_days` as SubscriptionBillingCycle,
      label: `Every ${d} Days`,
      shortLabel: `${d} Days`,
      badgeLabel: `${d}-Day Pass`,
      months: d / 30.4375,
      days: d,
      isMultiMonth: d >= 45,
    };
  }

  return STANDARD_BILLING_CYCLES[1]; // Default monthly
}

/**
 * Normalizes any subscription amount & billing cycle into its monthly equivalent.
 */
export function getNormalizedMonthlyAmount(amountInput: string | number, cycle?: string | null): number {
  const amt = typeof amountInput === 'number' ? amountInput : parseFloat(String(amountInput)) || 0;
  if (amt <= 0) return 0;

  const raw = (cycle || 'monthly').trim().toLowerCase();
  if (raw === 'weekly') return (amt * 52) / 12;
  if (raw === 'biweekly') return (amt * 26) / 12;
  if (raw === 'yearly') return amt / 12;
  if (raw === 'quarterly' || raw === 'every_3_months') return amt / 3;
  if (raw === 'every_2_months') return amt / 2;
  if (raw === 'every_6_months') return amt / 6;

  const meta = getCycleMeta(raw);
  if (meta.months > 0) {
    return amt / meta.months;
  }
  return amt;
}

/**
 * Normalizes any subscription amount & billing cycle into its daily cost.
 */
export function getNormalizedDailyAmount(amountInput: string | number, cycle?: string | null): number {
  const amt = typeof amountInput === 'number' ? amountInput : parseFloat(String(amountInput)) || 0;
  if (amt <= 0) return 0;
  const meta = getCycleMeta(cycle);
  return amt / Math.max(1, meta.days);
}

/**
 * Adds or subtracts one billing cycle interval from a given reference date.
 */
export function shiftDateByCycle(baseDate: Date, cycle?: string | null, direction: 1 | -1 = 1): Date {
  const result = new Date(baseDate.getTime());
  const raw = (cycle || 'monthly').trim().toLowerCase();

  if (raw === 'weekly') {
    result.setDate(result.getDate() + 7 * direction);
    return result;
  }
  if (raw === 'biweekly') {
    result.setDate(result.getDate() + 14 * direction);
    return result;
  }
  if (raw === 'yearly') {
    result.setFullYear(result.getFullYear() + 1 * direction);
    return result;
  }
  if (raw === 'quarterly' || raw === 'every_3_months') {
    result.setMonth(result.getMonth() + 3 * direction);
    return result;
  }
  if (raw === 'every_2_months') {
    result.setMonth(result.getMonth() + 2 * direction);
    return result;
  }
  if (raw === 'every_6_months') {
    result.setMonth(result.getMonth() + 6 * direction);
    return result;
  }

  const customMonthsMatch = raw.match(/^every_(\d+)_months?$/);
  if (customMonthsMatch) {
    const n = Math.max(1, parseInt(customMonthsMatch[1], 10));
    result.setMonth(result.getMonth() + n * direction);
    return result;
  }

  const customDaysMatch = raw.match(/^every_(\d+)_days?$/);
  if (customDaysMatch) {
    const d = Math.max(1, parseInt(customDaysMatch[1], 10));
    result.setDate(result.getDate() + d * direction);
    return result;
  }

  result.setMonth(result.getMonth() + 1 * direction);
  return result;
}

/**
 * Computes term progress (start date, end/renewal date, elapsed days, total days, percent elapsed, and sinking fund target)
 * for any subscription or multi-month term pass.
 */
export function computeTermProgress(nextBillingDateStr?: string | null, cycle?: string | null) {
  const meta = getCycleMeta(cycle);
  if (!nextBillingDateStr) {
    return {
      hasSchedule: false,
      startDate: null as Date | null,
      endDate: null as Date | null,
      totalDays: meta.days,
      elapsedDays: 0,
      daysRemaining: null as number | null,
      percentElapsed: 0,
      percentRemaining: 100,
    };
  }

  const endDate = new Date(nextBillingDateStr);
  if (isNaN(endDate.getTime())) {
    return {
      hasSchedule: false,
      startDate: null,
      endDate: null,
      totalDays: meta.days,
      elapsedDays: 0,
      daysRemaining: null,
      percentElapsed: 0,
      percentRemaining: 100,
    };
  }

  const startDate = shiftDateByCycle(endDate, cycle, -1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMidnight = new Date(startDate.getTime());
  startMidnight.setHours(0, 0, 0, 0);
  const endMidnight = new Date(endDate.getTime());
  endMidnight.setHours(0, 0, 0, 0);

  const totalDays = Math.max(1, Math.round((endMidnight.getTime() - startMidnight.getTime()) / 86400000));
  const daysRemaining = Math.round((endMidnight.getTime() - today.getTime()) / 86400000);
  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - daysRemaining));
  const percentElapsed = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
  const percentRemaining = Math.max(0, 100 - percentElapsed);

  return {
    hasSchedule: true,
    startDate: startMidnight,
    endDate: endMidnight,
    totalDays,
    elapsedDays,
    daysRemaining,
    percentElapsed,
    percentRemaining,
  };
}
