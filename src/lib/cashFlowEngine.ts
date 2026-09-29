import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { Transaction, KPI } from '../types';

export interface HistoricalCashFlowDay {
  date: string;
  openingBalance: number;
  netChange: number;
  closingBalance: number;
  transactions: Transaction[];
}

export function generateHistoricalCashFlow(
  transactions: Transaction[],
  currentTotalLiquidity: number
): HistoricalCashFlowDay[] {
  // Group transactions by date (YYYY-MM-DD)
  const grouped = new Map<string, Transaction[]>();
  
  transactions.forEach(t => {
    const d = format(parseISO(t.createdAt), 'yyyy-MM-dd');
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(t);
  });

  // Get all unique dates, plus today
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const allDates = Array.from(grouped.keys());
  if (!allDates.includes(todayStr)) allDates.push(todayStr);

  // Sort dates descending (newest first)
  allDates.sort((a, b) => b.localeCompare(a));

  const days: HistoricalCashFlowDay[] = [];
  let runningBalance = currentTotalLiquidity;

  for (const dateStr of allDates) {
    const dayTx = grouped.get(dateStr) || [];
    
    let netChange = 0;
    dayTx.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'Income') netChange += amt;
      else if (t.type === 'Expense') netChange -= amt;
      else if (t.type === 'Debt Repayment') netChange -= amt; // Assuming outflow by default for debt repayment in total liquidity context
    });

    const closingBalance = runningBalance;
    const openingBalance = closingBalance - netChange;

    days.push({
      date: dateStr,
      openingBalance,
      netChange,
      closingBalance,
      transactions: dayTx,
    });

    // The opening balance of this day becomes the closing balance of the previous (older) day
    runningBalance = openingBalance;
  }

  return days;
}
