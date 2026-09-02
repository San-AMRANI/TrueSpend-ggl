/**
 * InsightsService — Phase 2 Personal Intelligence
 *
 * Computes spending patterns, merchant stats, anomaly detection,
 * subscription detection, and budget recommendations purely from
 * the existing transaction data. No new DB tables required.
 */
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { getCurrentFinancialMonth, getPreviousFinancialMonth, getFinancialPeriods, isInFinancialMonth } from '../../src/lib/financialMonth.js';

function toAmt(v: unknown) { return parseFloat(v as any) || 0; }

function normalizeMerchantName(raw: string): string {
  if (!raw) return 'Unknown';
  let name = raw.toLowerCase().trim();
  name = name.replace(/^(coffee|meal|purchase|payment)\s+at\s+/i, '');
  name = name.replace(/[.,/#()[\]{}]/g, ' ');
  name = name.replace(/\b(maarif|casablanca|rabat|marrakech|store|shop|online|inc|ltd|llc|ma|co)\b/gi, ' ');
  name = name.replace(/\s+/g, ' ').trim();
    return name ? name.replace(/\b\w/g, (character) => character.toUpperCase()) : 'Unknown';
}


export class InsightsService {
  async getInsights(userId: string, payrolls: any[]) {
    const allTx = await transactionRepository.findAllByUserId(userId);
    const expenses = allTx.filter((t) => t.type === 'Expense');

    const now = new Date();
    const currentFm = getCurrentFinancialMonth(payrolls, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const previousFm = currentFm ? getPreviousFinancialMonth(payrolls, currentFm) : null;

    // ── Spending Patterns ──────────────────────────────────────────────
    // Compare current period vs 3-month average per category
    const periods = getFinancialPeriods(payrolls).slice(-4); // last 4 periods max
    const patterns: any[] = [];

    if (currentFm && periods.length >= 2) {
      const currentPeriodExpenses = expenses.filter((t) =>
        isInFinancialMonth(new Date(t.createdAt!), payrolls, currentFm.year, currentFm.month)
      );

      const historicalPeriods = periods
        .filter((p) => !(p.year === currentFm.year && p.month === currentFm.month))
        .slice(-3);
      const categorySet = new Set([
        ...currentPeriodExpenses.map((t) => t.category || 'Uncategorized'),
        ...expenses
          .filter((t) => historicalPeriods.some((p) => isInFinancialMonth(new Date(t.createdAt!), payrolls, p.year, p.month)))
          .map((t) => t.category || 'Uncategorized'),
      ]);
      const currentElapsedDays = Math.max(1, Math.min(
        Math.round((today.getTime() - currentFm.start.getTime()) / 86_400_000) + 1,
        Math.round((currentFm.end.getTime() - currentFm.start.getTime()) / 86_400_000) + 1,
      ));

      for (const cat of categorySet) {
        const currentTotal = currentPeriodExpenses
          .filter((t) => (t.category || 'Uncategorized') === cat)
          .reduce((s, t) => s + toAmt(t.amount), 0);

        const historicalDailyRates = historicalPeriods.map((p) => {
          const pExpenses = expenses.filter((t) =>
            (t.category || 'Uncategorized') === cat &&
            isInFinancialMonth(new Date(t.createdAt!), payrolls, p.year, p.month)
          );
           const sum = pExpenses.reduce((s, t) => s + toAmt(t.amount), 0);
           const days = Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000) + 1);
           return sum / days;
        });
          if (historicalDailyRates.length > 0) {
            const historicalDailyAverage = historicalDailyRates.reduce((s, value) => s + value, 0) / historicalDailyRates.length;
            const historicalComparableTotal = historicalDailyAverage * currentElapsedDays;
            const changePercent = historicalComparableTotal > 0 ? ((currentTotal - historicalComparableTotal) / historicalComparableTotal) * 100 : 0;
           const trend = Math.abs(changePercent) < 10 ? 'stable' : changePercent > 0 ? 'up' : 'down';
           
            patterns.push({ category: cat, currentMonthTotal: currentTotal, threeMonthAvg: Math.round(historicalComparableTotal), changePercent: Math.round(changePercent * 10) / 10, trend });
        } else {
           patterns.push({ category: cat, currentMonthTotal: currentTotal, threeMonthAvg: 0, changePercent: 0, trend: 'stable' });
        }
        continue;

      }

      patterns.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    }

    // ── Merchant Intelligence ──────────────────────────────────────────
    // Use notes field as "merchant name" for now; group by notes
    const merchantMap = new Map<string, { total: number; count: number; amounts: number[]; thisMonth: number; lastMonth: number; category: string }>();

    for (const t of expenses) {
      const merchant = normalizeMerchantName(t.notes?.trim() || t.category || 'Unknown');
      if (!merchantMap.has(merchant)) merchantMap.set(merchant, { total: 0, count: 0, amounts: [], thisMonth: 0, lastMonth: 0, category: t.category || '' });
      const entry = merchantMap.get(merchant)!;
      const amt = toAmt(t.amount);
      entry.total += amt;
      entry.count += 1;
      entry.amounts.push(amt);

      const txDate = new Date(t.createdAt!);
      if (currentFm && isInFinancialMonth(txDate, payrolls, currentFm.year, currentFm.month)) entry.thisMonth += amt;
      if (previousFm && isInFinancialMonth(txDate, payrolls, previousFm.year, previousFm.month)) entry.lastMonth += amt;
    }

    const merchants = Array.from(merchantMap.entries())
      .filter(([, v]) => v.count >= 2) // only merchants with multiple transactions
      .map(([name, v]) => {
        const avg = v.total / v.count;
        const changePercent = v.lastMonth > 0 ? ((v.thisMonth - v.lastMonth) / v.lastMonth) * 100 : 0;
        return { name, total: Math.round(v.total), count: v.count, avgAmount: Math.round(avg * 100) / 100, thisMonth: Math.round(v.thisMonth), lastMonth: Math.round(v.lastMonth), changePercent: Math.round(changePercent * 10) / 10 };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // ── Anomaly Detection ──────────────────────────────────────────────
    // Flag transactions where amount is 2x+ above category average
    const categoryAvgs = new Map<string, number>();
    const catTotals = new Map<string, { sum: number; count: number; amounts: number[] }>();
    for (const t of expenses) {
      const cat = t.category || 'Uncategorized';
      if (!catTotals.has(cat)) catTotals.set(cat, { sum: 0, count: 0, amounts: [] });
      const entry = catTotals.get(cat)!;
      entry.sum += toAmt(t.amount);
      entry.count += 1;
      entry.amounts.push(toAmt(t.amount));
    }
    for (const [cat, { sum, count }] of catTotals) categoryAvgs.set(cat, sum / count);

    const anomalies: any[] = [];
    const recentDate = new Date(now.getTime() - 30 * 86_400_000); // last 30 days
    for (const t of expenses) {
      const txDate = new Date(t.createdAt!);
      if (txDate < recentDate) continue;
      const cat = t.category || 'Uncategorized';
      const amt = toAmt(t.amount);
      const categoryData = catTotals.get(cat);
      const peerCount = (categoryData?.count ?? 0) - 1;
      const peerSum = (categoryData?.sum ?? 0) - amt;
      const avg = peerCount > 0 ? peerSum / peerCount : categoryAvgs.get(cat) ?? 0;
      if (avg > 0 && amt >= Math.max(100, avg * 2.5)) {
        const deviationRatio = amt / avg;
        const severity = deviationRatio >= 5 ? 'high' : deviationRatio >= 3 ? 'medium' : 'low';
        const count = categoryData?.count ?? 0;
        let confidence = Math.min(100, Math.round(45 + (deviationRatio * 10) + (Math.min(count, 10) * 2)));
        confidence = Math.max(0, Math.min(100, confidence));
        anomalies.push({
          transactionId: t.id,
          date: txDate.toISOString(),
          amount: amt,
          category: cat,
          notes: t.notes || '',
          reason: `${(amt / avg).toFixed(1)}× above your average for ${cat} (avg: ${Math.round(avg)} MAD)`,
          severity,
          avgAmount: Math.round(avg),
          confidence,
        });
      }
    }
    anomalies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── Subscription Detection ─────────────────────────────────────────
    // Find notes+amount combinations that appear multiple months
    type SubKey = string;
    const subMap = new Map<SubKey, { months: Set<string>; amounts: number[]; lastDate: string; category: string }>();

    for (const t of expenses) {
      const txDate = new Date(t.createdAt!);
      const note = t.notes?.trim();
      if (!note) continue;
      const amt = toAmt(t.amount);
      const monthKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;
      const key = `${note.toLowerCase()}::${Math.round(amt)}`;

      if (!subMap.has(key)) subMap.set(key, { months: new Set(), amounts: [], lastDate: t.createdAt!.toString(), category: t.category || '' });
      const entry = subMap.get(key)!;
      entry.months.add(monthKey);
      entry.amounts.push(amt);
      if (new Date(t.createdAt!) > new Date(entry.lastDate)) entry.lastDate = t.createdAt!.toString();
    }

    const subscriptions = Array.from(subMap.entries())
      .filter(([, v]) => v.months.size >= 2)
      .map(([key, v]) => {
        const [name] = key.split('::');
        const amount = Math.round(v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length);
        const frequency = v.months.size >= 4 ? 'monthly' : 'monthly';
        const annualCost = amount * 12;
        // Confidence based on occurrences vs expected occurrences
        const confidence = Math.min(100, Math.round(70 + (v.months.size * 5)));
        return { name: name.trim(), amount, category: v.category, frequency, occurrences: v.months.size, annualCost, lastSeen: v.lastDate,
          confidence };
      })
      .sort((a, b) => b.annualCost - a.annualCost)
      .slice(0, 15);

    // ── Budget Recommendations ─────────────────────────────────────────
    // Average spending per category over last 3 financial periods
    const budgetRecs: { category: string; suggestedAmount: number; avgMonthly: number; periods: number }[] = [];

    if (periods.length >= 2) {
      const histPeriods = periods.slice(-3);
      const catSums = new Map<string, number[]>();

      for (const p of histPeriods) {
        const periodExpenses = expenses.filter((t) =>
          isInFinancialMonth(new Date(t.createdAt!), payrolls, p.year, p.month)
        );
        const periodCats = new Map<string, number>();
        for (const t of periodExpenses) {
          const cat = t.category || 'Uncategorized';
          periodCats.set(cat, (periodCats.get(cat) ?? 0) + toAmt(t.amount));
        }
        for (const [cat, total] of periodCats) {
          if (!catSums.has(cat)) catSums.set(cat, []);
          catSums.get(cat)!.push(total);
        }
      }

      for (const [cat, sums] of catSums) {
        const avg = sums.reduce((s, v) => s + v, 0) / sums.length;
        // Suggest 10% padding above average
        const suggested = Math.ceil(avg * 1.1 / 50) * 50; // round to nearest 50
        budgetRecs.push({ category: cat, suggestedAmount: suggested, avgMonthly: Math.round(avg), periods: sums.length });
      }
      budgetRecs.sort((a, b) => b.avgMonthly - a.avgMonthly);
    }

    return { patterns, merchants, anomalies, subscriptions, budgetRecommendations: budgetRecs };
  }
}

export const insightsService = new InsightsService();
