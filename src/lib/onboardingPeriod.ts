export type EmploymentType = 'employee' | 'non_employee';
export type FinancialCycleMode = 'payday_to_payday' | 'calendar_month' | 'custom_period';
export type OnboardingStartingPoint = 'first_day' | 'mid_cycle';

export interface ComputePeriodInput {
  employmentType: EmploymentType;
  financialCycleMode: FinancialCycleMode;
  startingPoint: OnboardingStartingPoint;
  paydayDay: number;
  customStartDate?: string | null;
  customNextPaydayDate?: string | null;
  now?: Date;
}

export interface ComputedOnboardingPeriod {
  periodStartDate: string; // YYYY-MM-DD (inclusive)
  periodEndDate: string; // YYYY-MM-DD (inclusive, day before nextPaydayDate)
  nextPaydayDate: string; // YYYY-MM-DD (closes current cycle & starts next)
  effectivePaydayDay: number;
  totalDays: number;
  elapsedDays: number;
  daysRemaining: number;
  financialMonthYear: number;
  financialMonthMonth: number;
  periodLabel: string;
}

export interface OnboardingAccountDraft {
  name: string;
  type: 'Bank' | 'Cash' | 'Savings';
  openingBalance: number;
  isMain?: boolean;
  currency?: string;
}

export interface OnboardingSetupValidationInput {
  employmentType: EmploymentType;
  financialCycleMode: FinancialCycleMode;
  startingPoint: OnboardingStartingPoint;
  paydayDay: number;
  salary: number;
  periodStartDate: string;
  nextPaydayDate: string;
  emergencyBuffer?: number;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateLocal(iso: string): Date | null {
  if (!DATE_ONLY_RE.test(iso)) return null;
  const [yStr, mStr, dStr] = iso.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function clampDayInMonth(year: number, monthIndex0: number, targetDay: number): Date {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(lastDay, Math.round(targetDay)));
  return new Date(year, monthIndex0, safeDay, 0, 0, 0, 0);
}

export function addDaysLocal(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

export function diffCalendarDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function formatPeriodDisplayLabel(startIso: string, endIso: string): string {
  const start = parseIsoDateLocal(startIso);
  const end = parseIsoDateLocal(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

/**
 * Deterministically computes the user's active financial period boundaries
 * (inclusive start, inclusive end, and closing/next payday) for onboarding and KPI setup.
 */
export function computeOnboardingPeriodDates(input: ComputePeriodInput): ComputedOnboardingPeriod {
  const now = input.now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const rawDay = Number.isFinite(Number(input.paydayDay)) ? Math.round(Number(input.paydayDay)) : 25;
  const effectivePaydayDay =
    input.financialCycleMode === 'calendar_month'
      ? 1
      : Math.max(1, Math.min(31, rawDay));

  let startDate: Date;
  let nextPayday: Date;

  if (input.financialCycleMode === 'custom_period') {
    const parsedStart = input.customStartDate ? parseIsoDateLocal(input.customStartDate) : null;
    const parsedNext = input.customNextPaydayDate ? parseIsoDateLocal(input.customNextPaydayDate) : null;

    if (parsedStart && parsedNext && parsedNext > parsedStart && parsedNext > today) {
      startDate = parsedStart <= today ? parsedStart : today;
      nextPayday = parsedNext;
    } else {
      startDate = input.startingPoint === 'first_day'
        ? today
        : clampDayInMonth(today.getFullYear(), today.getMonth(), 1);
      const nextMonthCandidate = clampDayInMonth(today.getFullYear(), today.getMonth() + 1, effectivePaydayDay);
      const thisMonthCandidate = clampDayInMonth(today.getFullYear(), today.getMonth(), effectivePaydayDay);
      nextPayday = thisMonthCandidate > today ? thisMonthCandidate : nextMonthCandidate;
    }
  } else if (input.financialCycleMode === 'calendar_month') {
    if (input.startingPoint === 'first_day' && today.getDate() > 1) {
      // Starting fresh today inside the month -> active partial cycle runs from today through end of month
      startDate = today;
      nextPayday = new Date(today.getFullYear(), today.getMonth() + 1, 1, 0, 0, 0, 0);
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
      nextPayday = new Date(today.getFullYear(), today.getMonth() + 1, 1, 0, 0, 0, 0);
    }
  } else {
    // payday_to_payday
    const thisMonthPayday = clampDayInMonth(today.getFullYear(), today.getMonth(), effectivePaydayDay);

    if (input.startingPoint === 'first_day') {
      // Fresh cycle starts today; next payday is either this month's upcoming payday (if > 10 days away)
      // or next month's payday if today is on/near payday.
      startDate = today;
      if (today.getTime() === thisMonthPayday.getTime()) {
        nextPayday = clampDayInMonth(today.getFullYear(), today.getMonth() + 1, effectivePaydayDay);
      } else if (thisMonthPayday > today) {
        const daysToThisPayday = diffCalendarDays(today, thisMonthPayday);
        nextPayday =
          daysToThisPayday >= 7
            ? thisMonthPayday
            : clampDayInMonth(today.getFullYear(), today.getMonth() + 1, effectivePaydayDay);
      } else {
        nextPayday = clampDayInMonth(today.getFullYear(), today.getMonth() + 1, effectivePaydayDay);
      }
    } else {
      // mid_cycle: find the latest payday on or before today, and the next payday strictly after today
      if (thisMonthPayday <= today) {
        startDate = thisMonthPayday;
        nextPayday = clampDayInMonth(today.getFullYear(), today.getMonth() + 1, effectivePaydayDay);
      } else {
        startDate = clampDayInMonth(today.getFullYear(), today.getMonth() - 1, effectivePaydayDay);
        nextPayday = thisMonthPayday;
      }
    }
  }

  const endDate = addDaysLocal(nextPayday, -1);
  const totalDays = Math.max(1, diffCalendarDays(startDate, endDate) + 1);
  const rawElapsed = diffCalendarDays(startDate, today) + 1;
  const elapsedDays = Math.max(1, Math.min(totalDays, rawElapsed));
  const daysRemaining = Math.max(1, diffCalendarDays(today, nextPayday));

  const periodStartDate = formatIsoDateLocal(startDate);
  const periodEndDate = formatIsoDateLocal(endDate);
  const nextPaydayDate = formatIsoDateLocal(nextPayday);

  return {
    periodStartDate,
    periodEndDate,
    nextPaydayDate,
    effectivePaydayDay,
    totalDays,
    elapsedDays,
    daysRemaining,
    financialMonthYear: nextPayday.getFullYear(),
    financialMonthMonth: nextPayday.getMonth() + 1,
    periodLabel: formatPeriodDisplayLabel(periodStartDate, periodEndDate),
  };
}

export function validateOnboardingSetup(
  input: OnboardingSetupValidationInput,
  now = new Date()
): { valid: boolean; error?: string } {
  if (input.employmentType !== 'employee' && input.employmentType !== 'non_employee') {
    return { valid: false, error: 'Please select whether you are a salaried employee or non-employee.' };
  }
  if (
    input.financialCycleMode !== 'payday_to_payday' &&
    input.financialCycleMode !== 'calendar_month' &&
    input.financialCycleMode !== 'custom_period'
  ) {
    return { valid: false, error: 'Please choose how your financial period should run.' };
  }
  if (input.startingPoint !== 'first_day' && input.startingPoint !== 'mid_cycle') {
    return { valid: false, error: 'Please indicate whether you are starting on Day 1 or mid-month.' };
  }
  if (!Number.isInteger(input.paydayDay) || input.paydayDay < 1 || input.paydayDay > 31) {
    return { valid: false, error: 'Payday / cycle anchor day must be between 1 and 31.' };
  }
  if (!Number.isFinite(input.salary) || input.salary < 0) {
    return { valid: false, error: 'Expected income cannot be negative.' };
  }
  if (input.employmentType === 'employee' && input.salary <= 0) {
    return {
      valid: false,
      error: 'As a salaried employee, please enter your net salary per pay cycle (greater than 0).',
    };
  }
  if (input.emergencyBuffer !== undefined && (!Number.isFinite(input.emergencyBuffer) || input.emergencyBuffer < 0)) {
    return { valid: false, error: 'Emergency buffer cannot be negative.' };
  }

  const start = parseIsoDateLocal(input.periodStartDate);
  const next = parseIsoDateLocal(input.nextPaydayDate);
  if (!start || !next) {
    return { valid: false, error: 'Please enter valid period start and next payday dates.' };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (start > today) {
    return { valid: false, error: 'Current period start date cannot be in the future.' };
  }
  if (next <= today) {
    return { valid: false, error: 'Next payday / cycle reset date must be at least tomorrow.' };
  }
  if (next <= start) {
    return { valid: false, error: 'Next payday date must be after the financial period start date.' };
  }

  return { valid: true };
}

export function computeOnboardingPreviewMetrics(params: {
  accounts: OnboardingAccountDraft[];
  emergencyBuffer: number;
  daysRemaining: number;
}) {
  const totalOpeningCash = params.accounts.reduce(
    (sum, acc) => sum + (Number.isFinite(Number(acc.openingBalance)) ? Number(acc.openingBalance) : 0),
    0
  );
  const savingsTotal = params.accounts
    .filter((acc) => acc.type === 'Savings')
    .reduce(
      (sum, acc) => sum + (Number.isFinite(Number(acc.openingBalance)) ? Number(acc.openingBalance) : 0),
      0
    );
  const protectedReserve = savingsTotal > 0 ? savingsTotal : Math.max(0, Number(params.emergencyBuffer) || 0);
  const spendableCash = Math.max(0, totalOpeningCash - protectedReserve);
  const safeDays = Math.max(1, Math.round(params.daysRemaining || 1));
  const dailyAllowance = spendableCash / safeDays;

  return {
    totalOpeningCash: Math.round(totalOpeningCash * 100) / 100,
    savingsTotal: Math.round(savingsTotal * 100) / 100,
    protectedReserve: Math.round(protectedReserve * 100) / 100,
    spendableCash: Math.round(spendableCash * 100) / 100,
    dailyAllowance: Math.round(dailyAllowance * 100) / 100,
  };
}
