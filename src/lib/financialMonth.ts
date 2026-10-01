/**
 * Financial periods are defined by consecutive calendar payrolls. A period starts
 * on one configured payroll date and ends the day before the next configured
 * payroll date. There is deliberately no implicit day-of-month fallback.
 */

export interface PayrollLike {
  id: string;
  scheduledFor: string | Date;
  amount: string | number;
}

export interface FinancialMonthRef {
  /** The calendar year of the payroll which closes this period. */
  year: number;
  /** The 1-based calendar month of the payroll which closes this period. */
  month: number;
}

export interface FinancialMonthBounds {
  start: Date;
  end: Date;
}

export interface FinancialPeriod extends FinancialMonthRef, FinancialMonthBounds {
  startPayroll: PayrollLike;
  endPayroll: PayrollLike;
}

const asDate = (value: string | Date) => new Date(value);
const startOfDay = (value: string | Date) => {
  const date = asDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};
const endOfPreviousDay = (value: string | Date) => {
  const date = startOfDay(value);
  date.setMilliseconds(-1);
  return date;
};
const sameRef = (left: FinancialMonthRef, right: FinancialMonthRef) => left.year === right.year && left.month === right.month;

export function getFinancialPeriods(payrolls: PayrollLike[]): FinancialPeriod[] {
  const sorted = payrolls
    .filter((payroll) => !Number.isNaN(asDate(payroll.scheduledFor).getTime()))
    .slice()
    .sort((left, right) => asDate(left.scheduledFor).getTime() - asDate(right.scheduledFor).getTime());

  const periods: FinancialPeriod[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startPayroll = sorted[index];
    const endPayroll = sorted[index + 1];
    const endPayrollDate = asDate(endPayroll.scheduledFor);
    periods.push({
      startPayroll,
      endPayroll,
      start: startOfDay(startPayroll.scheduledFor),
      end: endOfPreviousDay(endPayroll.scheduledFor),
      year: endPayrollDate.getFullYear(),
      month: endPayrollDate.getMonth() + 1,
    });
  }
  return periods;
}

export function getFinancialMonthBounds(payrolls: PayrollLike[], year: number, month: number): FinancialMonthBounds | null {
  const period = getFinancialPeriods(payrolls).find((item) => item.year === year && item.month === month);
  return period ? { start: period.start, end: period.end } : null;
}

export function getFinancialMonthRef(date: Date, payrolls: PayrollLike[]): FinancialMonthRef | null {
  const period = getFinancialPeriods(payrolls).find((item) => date >= item.start && date <= item.end);
  return period ? { year: period.year, month: period.month } : null;
}

export function getCurrentFinancialMonth(payrolls: PayrollLike[], now = new Date()): FinancialPeriod | null {
  const day = startOfDay(now);
  return getFinancialPeriods(payrolls).find((item) => day >= item.start && day <= item.end) || null;
}

export function getPreviousFinancialMonth(payrolls: PayrollLike[], current: FinancialMonthRef): FinancialPeriod | null {
  const periods = getFinancialPeriods(payrolls);
  const index = periods.findIndex((item) => sameRef(item, current));
  return index > 0 ? periods[index - 1] : null;
}

export function getNextPayroll(payrolls: PayrollLike[], now = new Date()): PayrollLike | null {
  const today = startOfDay(now).getTime();
  return payrolls
    .filter((payroll) => startOfDay(payroll.scheduledFor).getTime() > today)
    .sort((left, right) => asDate(left.scheduledFor).getTime() - asDate(right.scheduledFor).getTime())[0] || null;
}

export function isInFinancialMonth(date: Date, payrolls: PayrollLike[], year: number, month: number): boolean {
  const bounds = getFinancialMonthBounds(payrolls, year, month);
  return Boolean(bounds && date >= bounds.start && date <= bounds.end);
}

export function financialMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function financialPeriodLabel(period: FinancialPeriod): string {
  const format = (date: Date, includeYear: boolean) => date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  return `${format(period.start, period.start.getFullYear() !== period.end.getFullYear())} – ${format(period.end, true)}`;
}

/** All complete configured financial periods, newest first. */
export function getFinancialMonthsFromTransactions(_transactions: { createdAt: string }[], payrolls: PayrollLike[]): FinancialPeriod[] {
  return getFinancialPeriods(payrolls).slice().reverse();
}
