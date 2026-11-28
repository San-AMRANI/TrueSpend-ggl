import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  LineChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Layers,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Debt, InvestmentsData, Transaction, Wallet } from '../../types';
import {
  ACCOUNTING_CLASS_ORDER,
  computeBalanceSheetSummary,
  getAccountSubtypeMeta,
  getGlCodeForWallet,
  isCreditLiabilitySubtype,
} from '../../lib/accountTaxonomy';
import {
  buildMultiWalletComparisonSeries,
  type WalletAnalyticsSummary,
  type WalletRangeKey,
} from '../../lib/walletAnalytics';

const fmtCompact = (val: number): string => {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return `${Math.round(val)}`;
};

const fmtMad = (val: number, decimals = 0): string =>
  `${val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MAD`;

/* ─────────────────────────────────────────────────────────────────────────────
 * Compact Inline Sparkline rendered directly inside each Wallet Card
 * ───────────────────────────────────────────────────────────────────────────── */
export const WalletCardSparkline: React.FC<{
  summary: WalletAnalyticsSummary | undefined;
  isLiability?: boolean;
  onInspect?: () => void;
}> = ({ summary, isLiability = false, onInspect }) => {
  if (!summary || summary.points.length === 0) return null;

  const isPositiveDelta = isLiability ? summary.netChange <= 0 : summary.netChange >= 0;
  const strokeColor = summary.chartColor || (isPositiveDelta ? '#10b981' : '#e11d48');
  const gradId = `spark-${summary.walletId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-gray-500 dark:text-gray-400 font-mono tabular-nums">
          {summary.daysCovered}d trend · {summary.txCount} tx{summary.txCount === 1 ? '' : 's'}
        </span>
        <span
          className={`font-mono tabular-nums font-semibold ${
            isPositiveDelta
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {summary.netChange >= 0 ? '+' : ''}
          {fmtMad(summary.netChange, 0)}
        </span>
      </div>

      <div className="h-[58px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={summary.points} margin={{ top: 3, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: 'rgba(148,163,184,0.35)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0]?.payload;
                return (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[11px] shadow-md font-mono tabular-nums">
                    <div className="font-sans font-semibold text-gray-900 dark:text-gray-100">
                      {pt.label}
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Bal: <strong>{Number(pt.balance).toFixed(0)} MAD</strong>
                    </div>
                    {(pt.inflow > 0 || pt.outflow > 0) && (
                      <div className="flex gap-2 text-[10px] pt-0.5">
                        {pt.inflow > 0 && <span className="text-emerald-600">+{pt.inflow}</span>}
                        {pt.outflow > 0 && <span className="text-rose-600">−{pt.outflow}</span>}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={strokeColor}
              strokeWidth={1.75}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <span className="text-emerald-600 dark:text-emerald-400">
            +{fmtCompact(summary.totalInflow)} in
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            −{fmtCompact(summary.totalOutflow)} out
          </span>
          {!isLiability && summary.assetSharePct > 0 && (
            <span>· {summary.assetSharePct}% share</span>
          )}
        </div>
        {onInspect && (
          <button
            type="button"
            onClick={onInspect}
            className="font-sans font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Full Graph →
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Full Balance Sheet + Interactive Per-Wallet Graph Studio
 * ───────────────────────────────────────────────────────────────────────────── */
interface WalletAnalyticsPanelProps {
  wallets: Wallet[];
  transactions: Transaction[];
  debts?: Debt[];
  investmentsData?: InvestmentsData | null;
  selectedWalletId: string | null;
  onSelectWalletId: (id: string) => void;
  range: WalletRangeKey;
  onRangeChange: (range: WalletRangeKey) => void;
}

export const WalletAnalyticsPanel: React.FC<WalletAnalyticsPanelProps> = ({
  wallets,
  transactions,
  debts = [],
  investmentsData = null,
  selectedWalletId,
  onSelectWalletId,
  range,
  onRangeChange,
}) => {
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [hiddenCompareIds, setHiddenCompareIds] = useState<Record<string, boolean>>({});

  const activeReceivables = useMemo(
    () =>
      debts
        .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
        .reduce((s, d) => s + (Number(d.remainingBalance) || 0), 0),
    [debts]
  );
  const activePayables = useMemo(
    () =>
      debts
        .filter((d) => d.type === 'Payable' && d.status === 'Pending')
        .reduce((s, d) => s + (Number(d.remainingBalance) || 0), 0),
    [debts]
  );

  const balanceSheet = useMemo(
    () =>
      computeBalanceSheetSummary(wallets, {
        stockPortfolioMad: investmentsData?.totalPortfolioValueMad ?? 0,
        activeReceivablesMad: activeReceivables,
        activePayablesMad: activePayables,
      }),
    [wallets, investmentsData?.totalPortfolioValueMad, activeReceivables, activePayables]
  );

  const comparison = useMemo(
    () => buildMultiWalletComparisonSeries(wallets, transactions, range),
    [wallets, transactions, range]
  );

  const activeWallet = useMemo(() => {
    if (selectedWalletId) {
      const found = wallets.find((w) => w.id === selectedWalletId);
      if (found) return found;
    }
    return wallets.find((w) => w.isMain) || wallets[0] || null;
  }, [wallets, selectedWalletId]);

  const activeSummary = activeWallet ? comparison.perWallet[activeWallet.id] : undefined;
  const activeMeta = activeWallet
    ? getAccountSubtypeMeta(activeWallet.accountSubtype, activeWallet.type)
    : null;
  const activeGl = activeWallet ? getGlCodeForWallet(activeWallet) : null;

  if (wallets.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ── Accounting Balance Sheet Summary Strip ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Chart of Accounts &amp; Balance Sheet Position
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
            <span>
              Net Equity:{' '}
              <strong className="text-gray-900 dark:text-white">
                {fmtMad(balanceSheet.netEquityMad, 0)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Debt / Asset:{' '}
              <strong
                className={
                  balanceSheet.debtToAssetPct <= 10
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {balanceSheet.debtToAssetPct.toFixed(1)}%
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
          {[
            {
              cls: ACCOUNTING_CLASS_ORDER[0],
              code: '10xx',
              amount: balanceSheet.liquidAssetsMad,
              sub: `${balanceSheet.accountsByClass['Liquid Asset'].length} liquid acct · ${balanceSheet.liquidSharePct.toFixed(0)}% of assets`,
              accent: 'text-indigo-600 dark:text-indigo-400',
              bar: 'bg-indigo-600',
            },
            {
              cls: ACCOUNTING_CLASS_ORDER[1],
              code: '11xx',
              amount: balanceSheet.reserveAssetsMad,
              sub: `${balanceSheet.accountsByClass['Reserve Asset'].length} vault acct · ${balanceSheet.reserveSharePct.toFixed(0)}% of assets`,
              accent: 'text-emerald-600 dark:text-emerald-400',
              bar: 'bg-emerald-500',
            },
            {
              cls: ACCOUNTING_CLASS_ORDER[2],
              code: '12xx',
              amount: balanceSheet.growthAssetsMad,
              sub: `${balanceSheet.accountsByClass['Growth Asset'].length} growth acct · ${balanceSheet.growthSharePct.toFixed(0)}% of assets`,
              accent: 'text-amber-600 dark:text-amber-400',
              bar: 'bg-amber-500',
            },
            {
              cls: ACCOUNTING_CLASS_ORDER[3],
              code: '20xx',
              amount: balanceSheet.creditLiabilitiesMad,
              sub:
                balanceSheet.debtPayablesMad > 0
                  ? `+ ${fmtMad(balanceSheet.debtPayablesMad, 0)} debt payables`
                  : `${balanceSheet.accountsByClass['Credit Liability'].length} credit line${balanceSheet.accountsByClass['Credit Liability'].length === 1 ? '' : 's'}`,
              accent:
                balanceSheet.creditLiabilitiesMad > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-gray-600 dark:text-gray-400',
              bar: 'bg-rose-500',
            },
          ].map((item) => (
            <div key={item.cls} className="p-3.5 sm:p-4 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-600 dark:text-gray-300">{item.cls}</span>
                <span className="font-mono text-[11px] text-gray-400">GL {item.code}</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${item.accent}`}>
                {fmtMad(item.amount, 0)}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                {item.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Asset Composition Proportional Bar */}
        {balanceSheet.totalAssetsMad > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex">
              <div
                className="h-full bg-indigo-600"
                style={{ width: `${Math.min(100, balanceSheet.liquidSharePct)}%` }}
                title={`Liquid Assets: ${fmtMad(balanceSheet.liquidAssetsMad, 0)}`}
              />
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, balanceSheet.reserveSharePct)}%` }}
                title={`Reserve Assets: ${fmtMad(balanceSheet.reserveAssetsMad, 0)}`}
              />
              <div
                className="h-full bg-amber-500"
                style={{ width: `${Math.min(100, balanceSheet.growthSharePct)}%` }}
                title={`Growth Capital: ${fmtMad(balanceSheet.growthAssetsMad, 0)}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Per-Wallet Balance Trajectory & Cashflow Graph Studio ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {viewMode === 'single' ? (
                <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              )}
              <span>
                {viewMode === 'single' && activeWallet
                  ? `${activeWallet.name} — Balance & Flow Graph`
                  : 'All Wallets Balance Trajectory Overlay'}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {viewMode === 'single' && activeMeta && activeGl
                ? `${activeMeta.label} · GL ${activeGl.code} · ${activeMeta.safeToSpendNote}`
                : 'Compare running daily balances across every account in your chart of accounts.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Mode Switch */}
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Per Wallet
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compare')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'compare'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Compare All
              </button>
            </div>

            {/* Range Switch */}
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5">
              {(['30d', '90d', '180d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRangeChange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase transition-colors whitespace-nowrap cursor-pointer ${
                    range === r
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Wallet Selector Tabs (Single Mode) or Visibility Toggles (Compare Mode) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {wallets.map((w) => {
            const meta = getAccountSubtypeMeta(w.accountSubtype, w.type);
            const isSelected = activeWallet?.id === w.id;
            const isHidden = Boolean(hiddenCompareIds[w.id]);

            if (viewMode === 'single') {
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelectWalletId(w.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.chartColor }}
                  />
                  <span>{w.name}</span>
                  <span className="font-mono tabular-nums opacity-75">
                    {fmtCompact(w.balance ?? 0)}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={w.id}
                type="button"
                onClick={() =>
                  setHiddenCompareIds((prev) => ({ ...prev, [w.id]: !prev[w.id] }))
                }
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity whitespace-nowrap cursor-pointer border border-gray-200 dark:border-gray-800 ${
                  isHidden
                    ? 'opacity-40 bg-gray-50 dark:bg-gray-900 text-gray-400'
                    : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: meta.chartColor }}
                />
                <span>{w.name}</span>
              </button>
            );
          })}
        </div>

        {/* Chart Canvas */}
        {viewMode === 'single' && activeSummary && activeWallet ? (
          <>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={activeSummary.points}
                  margin={{ top: 10, right: 12, left: -6, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="walletDeepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeSummary.chartColor} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={activeSummary.chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(148,163,184,0.18)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={22}
                  />
                  <YAxis
                    yAxisId="bal"
                    tickFormatter={fmtCompact}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <YAxis
                    yAxisId="flow"
                    orientation="right"
                    tickFormatter={fmtCompact}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                    hide={activeSummary.totalInflow === 0 && activeSummary.totalOutflow === 0}
                  />
                  <ReferenceLine
                    yAxisId="bal"
                    y={activeSummary.openingBalance}
                    stroke="rgba(148,163,184,0.45)"
                    strokeDasharray="4 4"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg text-xs font-mono tabular-nums space-y-1">
                          <div className="font-sans font-semibold text-gray-900 dark:text-white">
                            {pt.label} · {activeWallet.name}
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Closing Balance</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {fmtMad(pt.balance, 2)}
                            </span>
                          </div>
                          {pt.inflow > 0 && (
                            <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                              <span>Inflow</span>
                              <span>+{fmtMad(pt.inflow, 2)}</span>
                            </div>
                          )}
                          {pt.outflow > 0 && (
                            <div className="flex justify-between gap-4 text-rose-600 dark:text-rose-400">
                              <span>Outflow</span>
                              <span>−{fmtMad(pt.outflow, 2)}</span>
                            </div>
                          )}
                          {pt.txCount > 0 && (
                            <div className="text-[10px] text-gray-400 pt-0.5">
                              {pt.txCount} transaction{pt.txCount === 1 ? '' : 's'} logged
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="flow"
                    dataKey="inflow"
                    fill="#10b981"
                    fillOpacity={0.35}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    yAxisId="flow"
                    dataKey="outflow"
                    fill="#f43f5e"
                    fillOpacity={0.35}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={14}
                  />
                  <Area
                    yAxisId="bal"
                    type="monotone"
                    dataKey="balance"
                    stroke={activeSummary.chartColor}
                    strokeWidth={2.25}
                    fill="url(#walletDeepGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Per-Wallet Accounting Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs font-mono tabular-nums">
              <div>
                <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400 block">
                  Period Net Change
                </span>
                <span
                  className={`text-sm font-bold inline-flex items-center gap-1 mt-0.5 ${
                    activeSummary.netChange >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {activeSummary.netChange >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {activeSummary.netChange >= 0 ? '+' : ''}
                  {fmtMad(activeSummary.netChange, 0)}
                </span>
                <span className="block text-[10px] text-gray-400">
                  From {fmtMad(activeSummary.openingBalance, 0)}
                </span>
              </div>

              <div>
                <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400 block">
                  Inflows / Transfers In
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-0.5">
                  <ArrowDownLeft className="h-3.5 w-3.5" />+{fmtMad(activeSummary.totalInflow, 0)}
                </span>
                <span className="block text-[10px] text-gray-400">
                  Transfers in: {fmtMad(activeSummary.transferIn, 0)}
                </span>
              </div>

              <div>
                <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400 block">
                  Outflows / Daily Burn
                </span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 mt-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />−{fmtMad(activeSummary.totalOutflow, 0)}
                </span>
                <span className="block text-[10px] text-gray-400">
                  {activeSummary.avgDailyOutflow.toFixed(0)} MAD/day avg
                </span>
              </div>

              <div>
                <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400 block">
                  Peak / Trough
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 block mt-0.5">
                  {fmtCompact(activeSummary.peakBalance)} / {fmtCompact(activeSummary.troughBalance)}
                </span>
                <span className="block text-[10px] text-gray-400">
                  {activeSummary.txCount} txs in {activeSummary.daysCovered}d
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400 block">
                  Top Spend Category
                </span>
                <span className="text-sm font-semibold font-sans text-gray-900 dark:text-gray-100 block truncate mt-0.5">
                  {activeSummary.topCategory || 'No expenses'}
                </span>
                <span className="block text-[10px] text-gray-400">
                  {activeSummary.topCategory
                    ? fmtMad(activeSummary.topCategorySpend, 0)
                    : isCreditLiabilitySubtype(activeWallet.accountSubtype)
                    ? 'Liability account'
                    : `${activeSummary.assetSharePct}% of total assets`}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={comparison.mergedPoints}
                margin={{ top: 10, right: 12, left: -6, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148,163,184,0.18)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={22}
                />
                <YAxis
                  tickFormatter={fmtCompact}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg text-xs font-mono tabular-nums space-y-1">
                        <div className="font-sans font-semibold text-gray-900 dark:text-white mb-1">
                          {label}
                        </div>
                        {payload.map((entry: any) => (
                          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-sans text-gray-600 dark:text-gray-300">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {fmtMad(Number(entry.value || 0), 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {wallets.map((w) => {
                  if (hiddenCompareIds[w.id]) return null;
                  const meta = getAccountSubtypeMeta(w.accountSubtype, w.type);
                  return (
                    <Line
                      key={w.id}
                      type="monotone"
                      dataKey={w.id}
                      name={w.name}
                      stroke={meta.chartColor}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3.5 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
