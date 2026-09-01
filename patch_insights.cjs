const fs = require('fs');

let code = fs.readFileSync('server/services/InsightsService.ts', 'utf8');

// 1. Merchant Normalization
const merchantNorm = `
function normalizeMerchantName(raw: string): string {
  if (!raw) return 'Unknown';
  let name = raw.toLowerCase().trim();
  name = name.replace(/^coffee at /i, '');
  name = name.replace(/^meal at /i, '');
  name = name.replace(/ (maarif|casablanca|rabat|marrakech|store|shop|online|inc|ltd|llc|ma|co)$/gi, '');
  return name.replace(/\b\w/g, c => c.toUpperCase()); // title case
}
`;
code = code.replace('function toAmt(v: unknown) { return parseFloat(v as any) || 0; }', 'function toAmt(v: unknown) { return parseFloat(v as any) || 0; }\n' + merchantNorm);

code = code.replace(/const merchant = t.notes\?\.trim\(\) \|\| t\.category \|\| 'Unknown';/, "const merchant = normalizeMerchantName(t.notes?.trim() || t.category || 'Unknown');");

// 2. Anomaly Confidence
code = code.replace(
  /const severity = amt >= avg \* 5 \? 'high' : amt >= avg \* 3 \? 'medium' : 'low';/,
  `const severity = amt >= avg * 5 ? 'high' : amt >= avg * 3 ? 'medium' : 'low';
        // Basic confidence heuristic: frequency of transactions and magnitude of deviation
        const count = catTotals.get(cat)!.count;
        const deviationRatio = amt / avg;
        let confidence = Math.min(100, Math.round(50 + (deviationRatio * 10) + (Math.min(count, 10) * 2)));
        confidence = Math.max(0, Math.min(100, confidence));`
);
code = code.replace(/avgAmount: Math\.round\(avg\),/, "avgAmount: Math.round(avg),\n          confidence,");

// 3. Subscription Confidence
code = code.replace(
  /const frequency = v\.months\.size >= 4 \? 'monthly' : 'monthly';\n\s*const annualCost = amount \* 12;/,
  `const frequency = v.months.size >= 4 ? 'monthly' : 'monthly';
        const annualCost = amount * 12;
        // Confidence based on occurrences vs expected occurrences
        const confidence = Math.min(100, Math.round(70 + (v.months.size * 5)));`
);
code = code.replace(/lastSeen: v\.lastDate/, "lastSeen: v.lastDate,\n          confidence");

// 4. Normalize Historical Spending by Days
// In the Spending Patterns calculation:
// Replace simple average with daily-rate normalized average if the current month is incomplete.
const spendingPatternsReplace = `
        const historicalTotals = historicalPeriods.map((p) => {
          const pExpenses = expenses.filter((t) =>
            (t.category || 'Uncategorized') === cat &&
            isInFinancialMonth(new Date(t.createdAt!), payrolls, p.year, p.month)
          );
          const sum = pExpenses.reduce((s, t) => s + toAmt(t.amount), 0);
          return { sum, year: p.year, month: p.month };
        });

        // Normalize based on elapsed days in current month
        let elapsedDays = 30;
        let totalMonthDays = 30;
        if (currentFm) {
           elapsedDays = Math.max(1, Math.round((today.getTime() - currentFm.start.getTime()) / 86_400_000) + 1);
           totalMonthDays = Math.max(1, Math.round((currentFm.end.getTime() - currentFm.start.getTime()) / 86_400_000) + 1);
        }
        
        let avg = 0;
        if (historicalTotals.length > 0) {
           // We scale historical totals to the elapsed days portion for a fairer comparison, or scale current up.
           // Usually it's better to project current to end of month.
           const currentProjected = (currentTotal / elapsedDays) * totalMonthDays;
           const histAvg = historicalTotals.reduce((s, v) => s + v.sum, 0) / historicalTotals.length;
           
           // We compare current projected to historical average
           const changePercent = histAvg > 0 ? ((currentProjected - histAvg) / histAvg) * 100 : 0;
           const trend = Math.abs(changePercent) < 10 ? 'stable' : changePercent > 0 ? 'up' : 'down';
           
           patterns.push({ category: cat, currentMonthTotal: currentTotal, threeMonthAvg: Math.round(histAvg), changePercent: Math.round(changePercent * 10) / 10, trend });
        } else {
           patterns.push({ category: cat, currentMonthTotal: currentTotal, threeMonthAvg: 0, changePercent: 0, trend: 'stable' });
        }
        continue;
`;

// It's a bit hard to replace the whole block exactly, I'll just rewrite the Spending Patterns loop with regex.
// Wait, I can do it via a more precise replace.
const regexSpendingPattern = /const historicalTotals = historicalPeriods\.map\(\(p\) =>[\s\S]*?trend }\);/m;

code = code.replace(regexSpendingPattern, spendingPatternsReplace);

// add today var
code = code.replace(/const currentFm = getCurrentFinancialMonth\(payrolls, now\);/, "const currentFm = getCurrentFinancialMonth(payrolls, now);\n    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());");

fs.writeFileSync('server/services/InsightsService.ts', code);
