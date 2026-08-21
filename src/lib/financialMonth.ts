/**
 * financialMonth.ts
 *
 * TrueSpend uses a "financial month" concept: a period that starts on the payday
 * (e.g. the 25th) and ends the day before the next payday. This is more meaningful
 * for budgeting and analytics than a calendar month because it aligns with cash flow.
 *
 * Example with payday = 25:
 *   Financial month "Aug 2026"  →  Jul 25 – Aug 24  (starts Jul 25, ends Aug 24)
 *   Financial month "Sep 2026"  →  Aug 25 – Sep 24
 *
 * The financial month is identified by the end month (the month the period *ends in*),
 * which coincides with when the next salary arrives, making it the natural "month label".
 *
 * API surface:
 *   getFinancialMonthBounds(payday, year, month)  →  { start, end }  (Date objects, inclusive)
 *   getCurrentFinancialMonth(payday)              →  { year, month }
 *   getPreviousFinancialMonth(payday, year, month)→  { year, month }
 *   isInFinancialMonth(date, payday, year, month) →  boolean
 *   financialMonthLabel(year, month)              →  "August 2026"
 *   getFinancialMonthsFromTransactions(txs, payday) → sorted array of { year, month }
 */

export interface FinancialMonthRef {
  year: number;
  /** 1-based month number (1 = January … 12 = December) */
  month: number;
}

export interface FinancialMonthBounds {
  /** First day of the financial month (inclusive), at midnight local time */
  start: Date;
  /** Last day of the financial month (inclusive), at end-of-day local time */
  end: Date;
}

/**
 * Returns the start/end dates for a financial month.
 *
 * The financial month identified by `(year, month)` runs from:
 *   • start: payday of the PREVIOUS calendar month
 *   • end:   (payday - 1) of the current calendar month
 *
 * With payday = 25 and target = Sep 2026:
 *   start = Aug 25, 2026
 *   end   = Sep 24, 2026
 */
export function getFinancialMonthBounds(
  payday: number,
  year: number,
  month: number, // 1-based
): FinancialMonthBounds {
  const safePayday = Math.max(1, Math.min(28, payday)); // cap at 28 to avoid month-end edge cases

  // Start = payday of previous calendar month
  const startMonth = month === 1 ? 12 : month - 1;
  const startYear = month === 1 ? year - 1 : year;
  const start = new Date(startYear, startMonth - 1, safePayday, 0, 0, 0, 0);

  // End = (payday - 1) of current calendar month  (day before next payday)
  const endDay = safePayday - 1;
  let end: Date;
  if (endDay <= 0) {
    // payday = 1 → financial month ends on last day of previous calendar month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayOfPrev = new Date(prevYear, prevMonth, 0).getDate(); // day 0 of next month = last day of prev
    end = new Date(prevYear, prevMonth - 1, lastDayOfPrev, 23, 59, 59, 999);
  } else {
    end = new Date(year, month - 1, endDay, 23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Returns the { year, month } of the financial month the given date falls in.
 */
export function getFinancialMonthRef(date: Date, payday: number): FinancialMonthRef {
  const safePayday = Math.max(1, Math.min(28, payday));
  const d = date.getDate();
  const m = date.getMonth() + 1; // 1-based
  const y = date.getFullYear();

  if (d >= safePayday) {
    // On or after payday → this is the START of the NEXT financial month
    // The financial month label is the NEXT calendar month
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    return { year: nextYear, month: nextMonth };
  } else {
    // Before payday → we're in the financial month labelled by current calendar month
    return { year: y, month: m };
  }
}

/**
 * Returns the financial month { year, month } that "now" falls in.
 */
export function getCurrentFinancialMonth(payday: number): FinancialMonthRef {
  return getFinancialMonthRef(new Date(), payday);
}

/**
 * Returns the financial month immediately before the given one.
 */
export function getPreviousFinancialMonth(
  _payday: number,
  year: number,
  month: number,
): FinancialMonthRef {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Returns true if `date` falls within the financial month (year, month) for the given payday.
 */
export function isInFinancialMonth(
  date: Date,
  payday: number,
  year: number,
  month: number,
): boolean {
  const { start, end } = getFinancialMonthBounds(payday, year, month);
  return date >= start && date <= end;
}

/**
 * Human-readable label: "August 2026"
 */
export function financialMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Collects the unique financial months represented by a list of transactions and
 * returns them sorted newest-first.
 */
export function getFinancialMonthsFromTransactions(
  transactions: { createdAt: string }[],
  payday: number,
): FinancialMonthRef[] {
  const seen = new Map<string, FinancialMonthRef>();
  for (const tx of transactions) {
    const date = new Date(tx.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const ref = getFinancialMonthRef(date, payday);
    const key = `${ref.year}-${ref.month}`;
    if (!seen.has(key)) seen.set(key, ref);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month,
  );
}
