import type { Transaction, Wallet } from '../types/index.js';
import { normalizeCategory } from './categories.js';
import { getAccountSubtypeMeta, isCreditLiabilitySubtype } from './accountTaxonomy.js';

export type WalletRangeKey = '30d' | '90d' | '180d' | 'all';

export interface WalletDailyPoint {
  dateKey: string;
  label: string;
  balance: number;
  inflow: number;
  outflow: number;
  netFlow: number;
  txCount: number;
}

export interface WalletAnalyticsSummary {
  walletId: string;
  walletName: string;
  chartColor: string;
  points: WalletDailyPoint[];
  openingBalance: number;
  closingBalance: number;
  netChange: number;
  netChangePct: number;
  totalInflow: number;
  totalOutflow: number;
  transferIn: number;
  transferOut: number;
  peakBalance: number;
  troughBalance: number;
  txCount: number;
  avgDailyOutflow: number;
  topCategory: string | null;
  topCategorySpend: number;
  assetSharePct: number;
  daysCovered: number;
}

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatShortDate = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Resolves the signed balance impact of a single transaction on a specific wallet.
 * Matches financialEngine.ts wallet resolution rules (including legacy 'Bank'/'Cash' ids & Transfers).
 */
export function resolveWalletTxDelta(
  tx: Transaction,
  wallet: Wallet,
  allWallets: Wallet[]
): { delta: number; inflow: number; outflow: number; isTransferIn: boolean; isTransferOut: boolean } {
  const amt = Math.abs(Number.parseFloat(String(tx.amount)) || 0);
  if (amt <= 0) {
    return { delta: 0, inflow: 0, outflow: 0, isTransferIn: false, isTransferOut: false };
  }

  const mainBank =
    allWallets.find((w) => w.type === 'Bank' && w.isMain) ||
    allWallets.find((w) => w.isMain && w.type !== 'Investment') ||
    allWallets.find((w) => w.type === 'Bank') ||
    allWallets[0];
  const defaultCash = allWallets.find((w) => w.type === 'Cash') || mainBank;

  let srcId = tx.walletId || null;
  if (!srcId || srcId === 'Bank') {
    srcId = tx.sourceWallet === 'Cash' ? defaultCash?.id ?? null : mainBank?.id ?? null;
  } else if (srcId === 'Cash') {
    srcId = defaultCash?.id ?? null;
  }

  let destId = tx.destinationWalletId || tx.toWalletId || null;
  if (destId === 'Bank') destId = mainBank?.id ?? null;
  else if (destId === 'Cash') destId = defaultCash?.id ?? null;

  const isSource = srcId === wallet.id;
  const isDest = destId === wallet.id;

  if (tx.type === 'Transfer') {
    if (isSource && isDest) {
      return { delta: 0, inflow: 0, outflow: 0, isTransferIn: false, isTransferOut: false };
    }
    if (isSource) {
      return { delta: -amt, inflow: 0, outflow: amt, isTransferIn: false, isTransferOut: true };
    }
    if (isDest) {
      return { delta: amt, inflow: amt, outflow: 0, isTransferIn: true, isTransferOut: false };
    }
    return { delta: 0, inflow: 0, outflow: 0, isTransferIn: false, isTransferOut: false };
  }

  if (!isSource) {
    return { delta: 0, inflow: 0, outflow: 0, isTransferIn: false, isTransferOut: false };
  }

  if (tx.type === 'Income') {
    return { delta: amt, inflow: amt, outflow: 0, isTransferIn: false, isTransferOut: false };
  }

  if (tx.type === 'Expense' || tx.type === 'Debt Repayment') {
    return { delta: -amt, inflow: 0, outflow: amt, isTransferIn: false, isTransferOut: false };
  }

  return { delta: 0, inflow: 0, outflow: 0, isTransferIn: false, isTransferOut: false };
}

/**
 * Reconstructs the exact daily running balance trajectory and flow telemetry for a single wallet
 * by walking backward from the wallet's authoritative live balance.
 */
export function buildWalletTimeSeries(
  wallet: Wallet,
  transactions: Transaction[],
  range: WalletRangeKey = '30d',
  allWallets: Wallet[] = [],
  now = new Date()
): WalletAnalyticsSummary {
  const walletList = allWallets.length > 0 ? allWallets : [wallet];
  const meta = getAccountSubtypeMeta(wallet.accountSubtype, wallet.type);
  const currentBal = Number(wallet.balance ?? 0) || 0;

  // Group deltas by YYYY-MM-DD for this wallet
  const dailyMap = new Map<
    string,
    { delta: number; inflow: number; outflow: number; transferIn: number; transferOut: number; txCount: number }
  >();
  const categorySpendMap = new Map<string, number>();

  let earliestTxDate: Date | null = null;

  for (const tx of transactions) {
    const impact = resolveWalletTxDelta(tx, wallet, walletList);
    if (impact.inflow === 0 && impact.outflow === 0) continue;

    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    if (!earliestTxDate || dt < earliestTxDate) earliestTxDate = dt;

    const key = toDateKey(dt);
    const cur = dailyMap.get(key) || {
      delta: 0,
      inflow: 0,
      outflow: 0,
      transferIn: 0,
      transferOut: 0,
      txCount: 0,
    };
    cur.delta += impact.delta;
    cur.inflow += impact.inflow;
    cur.outflow += impact.outflow;
    if (impact.isTransferIn) cur.transferIn += impact.inflow;
    if (impact.isTransferOut) cur.transferOut += impact.outflow;
    cur.txCount += 1;
    dailyMap.set(key, cur);
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let rangeDays = range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365;
  if (range === 'all' && earliestTxDate) {
    const earliestDay = new Date(
      earliestTxDate.getFullYear(),
      earliestTxDate.getMonth(),
      earliestTxDate.getDate()
    );
    const diffDays = Math.ceil((today.getTime() - earliestDay.getTime()) / 86_400_000) + 1;
    rangeDays = Math.max(14, Math.min(365, diffDays));
  } else if (range === 'all') {
    rangeDays = 30;
  }

  // Build date keys chronologically from start -> today
  const dateKeys: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dateKeys.push(toDateKey(d));
  }
  const startKey = dateKeys[0];

  // Track top expense category inside the selected range
  for (const tx of transactions) {
    if (tx.type !== 'Expense' && tx.type !== 'Debt Repayment') continue;
    const impact = resolveWalletTxDelta(tx, wallet, walletList);
    if (impact.outflow <= 0) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    if (toDateKey(dt) < startKey) continue;
    const cat = normalizeCategory(tx.category || '📦 Others');
    categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + impact.outflow);
  }

  // Reconstruct closing balance for each day by walking backward from today's authoritative balance
  // First undo any future-dated transactions after today
  const todayKey = toDateKey(today);
  let runningEndOfToday = currentBal;
  for (const [k, v] of dailyMap.entries()) {
    if (k > todayKey) {
      runningEndOfToday -= v.delta;
    }
  }

  const balancesByDay = new Array<number>(dateKeys.length);
  let cursorBal = runningEndOfToday;
  for (let idx = dateKeys.length - 1; idx >= 0; idx -= 1) {
    balancesByDay[idx] = Number(cursorBal.toFixed(2));
    const dayEntry = dailyMap.get(dateKeys[idx]);
    if (dayEntry) {
      cursorBal -= dayEntry.delta;
    }
  }
  const openingBalance = Number(cursorBal.toFixed(2));

  let totalInflow = 0;
  let totalOutflow = 0;
  let transferIn = 0;
  let transferOut = 0;
  let txCount = 0;
  let peakBalance = -Infinity;
  let troughBalance = Infinity;

  const points: WalletDailyPoint[] = dateKeys.map((key, idx) => {
    const entry = dailyMap.get(key);
    const bal = balancesByDay[idx];
    if (bal > peakBalance) peakBalance = bal;
    if (bal < troughBalance) troughBalance = bal;

    const inflow = entry ? Number(entry.inflow.toFixed(2)) : 0;
    const outflow = entry ? Number(entry.outflow.toFixed(2)) : 0;
    totalInflow += inflow;
    totalOutflow += outflow;
    transferIn += entry?.transferIn ?? 0;
    transferOut += entry?.transferOut ?? 0;
    txCount += entry?.txCount ?? 0;

    return {
      dateKey: key,
      label: formatShortDate(key),
      balance: bal,
      inflow,
      outflow,
      netFlow: Number((inflow - outflow).toFixed(2)),
      txCount: entry?.txCount ?? 0,
    };
  });

  if (!Number.isFinite(peakBalance)) peakBalance = currentBal;
  if (!Number.isFinite(troughBalance)) troughBalance = currentBal;

  const closingBalance = points.length > 0 ? points[points.length - 1].balance : currentBal;
  const netChange = Number((closingBalance - openingBalance).toFixed(2));
  const netChangePct =
    Math.abs(openingBalance) > 1
      ? (netChange / Math.abs(openingBalance)) * 100
      : netChange !== 0
      ? 100
      : 0;

  let topCategory: string | null = null;
  let topCategorySpend = 0;
  for (const [cat, val] of categorySpendMap.entries()) {
    if (val > topCategorySpend) {
      topCategorySpend = val;
      topCategory = cat;
    }
  }

  const totalPositiveAssets = walletList.reduce((sum, w) => {
    if (isCreditLiabilitySubtype(w.accountSubtype)) return sum;
    return sum + Math.max(0, Number(w.balance ?? 0) || 0);
  }, 0);
  const assetSharePct =
    !isCreditLiabilitySubtype(wallet.accountSubtype) && totalPositiveAssets > 0
      ? (Math.max(0, currentBal) / totalPositiveAssets) * 100
      : 0;

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    chartColor: meta.chartColor,
    points,
    openingBalance,
    closingBalance,
    netChange,
    netChangePct,
    totalInflow: Number(totalInflow.toFixed(2)),
    totalOutflow: Number(totalOutflow.toFixed(2)),
    transferIn: Number(transferIn.toFixed(2)),
    transferOut: Number(transferOut.toFixed(2)),
    peakBalance: Number(peakBalance.toFixed(2)),
    troughBalance: Number(troughBalance.toFixed(2)),
    txCount,
    avgDailyOutflow: Number((totalOutflow / Math.max(1, dateKeys.length)).toFixed(2)),
    topCategory,
    topCategorySpend: Number(topCategorySpend.toFixed(2)),
    assetSharePct: Number(assetSharePct.toFixed(1)),
    daysCovered: dateKeys.length,
  };
}

/**
 * Builds a synchronized multi-wallet daily balance dataset for comparing all wallets
 * side by side on a single chart.
 */
export function buildMultiWalletComparisonSeries(
  wallets: Wallet[],
  transactions: Transaction[],
  range: WalletRangeKey = '30d',
  now = new Date()
): {
  perWallet: Record<string, WalletAnalyticsSummary>;
  mergedPoints: Array<Record<string, string | number>>;
} {
  const perWallet: Record<string, WalletAnalyticsSummary> = {};
  for (const w of wallets) {
    perWallet[w.id] = buildWalletTimeSeries(w, transactions, range, wallets, now);
  }

  const first = wallets[0] ? perWallet[wallets[0].id] : null;
  if (!first) return { perWallet, mergedPoints: [] };

  // Align on the longest date sequence (relevant for 'all')
  let longest = first.points;
  for (const w of wallets) {
    const pts = perWallet[w.id]?.points || [];
    if (pts.length > longest.length) longest = pts;
  }

  const walletLookup = new Map<string, Map<string, number>>();
  for (const w of wallets) {
    const m = new Map<string, number>();
    for (const pt of perWallet[w.id]?.points || []) {
      m.set(pt.dateKey, pt.balance);
    }
    walletLookup.set(w.id, m);
  }

  const mergedPoints = longest.map((pt) => {
    const row: Record<string, string | number> = {
      dateKey: pt.dateKey,
      label: pt.label,
    };
    let totalAll = 0;
    for (const w of wallets) {
      const val = walletLookup.get(w.id)?.get(pt.dateKey) ?? perWallet[w.id]?.openingBalance ?? 0;
      row[w.id] = val;
      if (!isCreditLiabilitySubtype(w.accountSubtype)) {
        totalAll += val;
      } else {
        totalAll -= Math.abs(Math.min(0, val));
      }
    }
    row.__total = Number(totalAll.toFixed(2));
    return row;
  });

  return { perWallet, mergedPoints };
}
