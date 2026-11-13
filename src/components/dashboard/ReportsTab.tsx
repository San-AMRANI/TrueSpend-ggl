import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Transaction, KPI, CategoryBudget, DashboardTab, FinancialPositionSnapshot, NetWorthChangeBridge } from '../../types';
import { FileBarChart, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Award, Sparkles, Database, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { normalizeCategory } from '../../lib/categories';
import { CycleRetrospectiveView } from './CycleRetrospectiveView';

interface ReportsTabProps {
  transactions: Transaction[];
  kpis: KPI | null;
  budgets: CategoryBudget[];
  onDataChange?: () => Promise<void> | void;
  onNavigateTab?: (tab: DashboardTab) => void;
}

interface ParsedTransactionRow {
  date?: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: 'Bank' | 'Cash';
  category: string;
  amount: number;
  notes: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ transactions, kpis, budgets, onDataChange, onNavigateTab }) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSubTab, setActiveSubTab] = useState<'retrospective' | 'position' | 'export' | 'import'>('retrospective');
  const [snapshots, setSnapshots] = useState<FinancialPositionSnapshot[]>([]);
  const [bridge, setBridge] = useState<NetWorthChangeBridge | null>(null);
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadPositionHistory = async () => {
    if (!token) return;
    setLoadingPosition(true);
    try {
      const res = await dashboardService.getFinancialPositionHistory(token);
      setSnapshots(res.snapshots || []);
      setBridge(res.bridge || null);
    } catch {
      // handled gracefully in empty state
    } finally {
      setLoadingPosition(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'position') {
      loadPositionHistory();
    }
  }, [activeSubTab, token]);

  const handleExportCSV = () => {
    if (!transactions.length) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { type: 'info', message: 'No transactions to export.' },
        })
      );
      return;
    }
    
    const headers = ['Date', 'Type', 'Wallet', 'Category', 'Amount', 'Notes'];
    
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (dateVal: string | Date | undefined) => {
      if (!dateVal) return '';
      try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
        return d.toISOString().split('T')[0];
      } catch {
        return String(dateVal).split('T')[0];
      }
    };

    const rows = transactions.map(t => [
      escapeCsv(formatDate(t.createdAt)),
      escapeCsv(t.type),
      escapeCsv(t.walletId),
      escapeCsv(t.category || ''),
      escapeCsv(Number(t.amount || 0).toFixed(2)),
      escapeCsv(t.notes || '')
    ].join(','));
    
    // Prefix with UTF-8 BOM (\uFEFF) and join rows with standard RFC 4180 CRLF (\r\n)
    // This ensures Google Sheets, Microsoft Excel, and Apple Numbers accurately parse columns and rows without returning empty sheets.
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TrueSpend_Transactions_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      reportDate: new Date().toISOString(),
      kpis,
      budgets,
      transactions
    }, null, 2));
    
    const link = document.createElement('a');
    link.href = dataStr;
    link.setAttribute('download', `TrueSpend_Financial_Report_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust CSV Parser respecting quotes, commas, and line breaks
  const parseCSVRows = (text: string): string[][] => {
    const output: string[][] = [];
    let row: string[] = [''];
    let inQuotes = false;

    let clean = text;
    if (clean.charCodeAt(0) === 0xFEFF) {
      clean = clean.slice(1);
    }

    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      const next = clean[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        if (row.length > 1 || row[0].trim() !== '') {
          output.push(row);
        }
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }

    if (row.length > 1 || row[0].trim() !== '') {
      output.push(row);
    }

    return output;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input for repeat selection
    e.target.value = '';
    setImportStatus(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      const rows = parseCSVRows(text);

      if (rows.length === 0) {
        setImportStatus({
          type: 'error',
          message: 'The selected CSV file is empty.'
        });
        setIsImporting(false);
        return;
      }

      if (rows.length === 1) {
        setImportStatus({
          type: 'error',
          message: 'The selected CSV contains only a header row with no transaction records.'
        });
        setIsImporting(false);
        return;
      }

      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      
      const findCol = (aliases: string[]) => {
        return headers.findIndex(h => aliases.includes(h));
      };

      const dateIdx = findCol(['date', 'transactiondate', 'createdat', 'time', 'timestamp']);
      const typeIdx = findCol(['type', 'transactiontype', 'flow']);
      const walletIdx = findCol(['wallet', 'sourcewallet', 'account', 'source']);
      const categoryIdx = findCol(['category', 'tag']);
      const amountIdx = findCol(['amount', 'value', 'total', 'price']);
      const notesIdx = findCol(['notes', 'note', 'description', 'memo', 'details']);

      if (amountIdx === -1) {
        setImportStatus({
          type: 'error',
          message: 'Missing "Amount" column in the CSV header. Please make sure your file includes an Amount column.'
        });
        setIsImporting(false);
        return;
      }

      const parsedRecords: ParsedTransactionRow[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every(cell => cell.trim() === '')) {
          continue;
        }

        const rawAmount = row[amountIdx]?.replace(/[^0-9.-]+/g, '') || '';
        const amount = Math.abs(parseFloat(rawAmount));
        if (isNaN(amount) || amount <= 0) {
          continue;
        }

        const rawType = (typeIdx !== -1 ? row[typeIdx] : '').trim().toLowerCase();
        let type: ParsedTransactionRow['type'] = 'Expense';
        if (rawType.includes('income') || rawType.includes('deposit') || rawType.includes('salary')) {
          type = 'Income';
        } else if (rawType.includes('transfer')) {
          type = 'Transfer';
        } else if (rawType.includes('repayment') || rawType.includes('debt')) {
          type = 'Debt Repayment';
        }

        const rawWallet = (walletIdx !== -1 ? row[walletIdx] : '').trim().toLowerCase();
        const walletId: ParsedTransactionRow['walletId'] = rawWallet.includes('cash') ? 'Cash' : 'Bank';

        const rawCat = categoryIdx !== -1 ? row[categoryIdx]?.trim() : '';
        const category = normalizeCategory(rawCat || (type === 'Income' ? '📥 Income' : '🚨 Unexpected'));

        const rawDate = dateIdx !== -1 ? row[dateIdx]?.trim() : '';
        let date: string | undefined = undefined;
        if (rawDate) {
          const parsedD = new Date(rawDate);
          if (!isNaN(parsedD.getTime())) {
            date = parsedD.toISOString();
          }
        }

        const notes = notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '';

        parsedRecords.push({
          date,
          type,
          walletId,
          category,
          amount,
          notes
        });
      }

      if (parsedRecords.length === 0) {
        setImportStatus({
          type: 'error',
          message: 'No valid transactions could be parsed from the sheet. Check amounts and formatting.'
        });
        setIsImporting(false);
        return;
      }

      // Execute import in sequential batches
      setImportProgress({ current: 0, total: parsedRecords.length });
      let successful = 0;

      for (let i = 0; i < parsedRecords.length; i++) {
        const rec = parsedRecords[i];
        try {
          await dashboardService.createTransaction({
            amount: rec.amount,
            type: rec.type,
            walletId: rec.walletId,
            category: rec.category,
            notes: rec.notes,
            ...(rec.date ? { transaction_date: rec.date } : {})
          }, token);
          successful++;
        } catch (err) {
          console.error('Failed to import row', rec, err);
        }
        setImportProgress({ current: i + 1, total: parsedRecords.length });
      }

      if (onDataChange) {
        await onDataChange();
      }

      setImportStatus({
        type: 'success',
        message: `Successfully imported ${successful} transaction${successful === 1 ? '' : 's'} into TrueSpend!`
      });
    } catch (err: any) {
      console.error('Import error', err);
      setImportStatus({
        type: 'error',
        message: err?.message || 'Failed to parse and import CSV file.'
      });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-500" />
            Financial Intelligence & Reports
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cycle report cards, payday retrospectives, data exports, and backups
          </p>
        </div>

        {/* Tab Pills */}
        <div className="ts-scrollbar flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 max-w-full overflow-x-auto self-start sm:self-auto">
          {(
            [
              { id: 'retrospective', label: 'AI Cycle Wrap-Up & Report Card', icon: Award },
              { id: 'position', label: 'Net Worth History & Bridge', icon: TrendingUp },
              { id: 'export', label: 'Export & Backup', icon: Download },
              { id: 'import', label: 'Import CSV', icon: Upload },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="reports-subtab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-gray-900 shadow-sm"
                  />
                )}
                <Icon className="relative z-10 w-3.5 h-3.5 shrink-0" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Retrospective View (Signature Feature) */}
      {activeSubTab === 'retrospective' && (
        <CycleRetrospectiveView onNavigateTab={onNavigateTab} />
      )}

      {/* Whole Financial Position History & Change Bridge */}
      {activeSubTab === 'position' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Whole-Financial-Position History &amp; Net Worth Bridge
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Attributed daily snapshots across liquid cash, credit/overdraft debt, receivables, payables, stock/crypto positions, and external valuations.
                </p>
              </div>
              <Button
                size="sm"
                disabled={loadingPosition}
                onClick={async () => {
                  setLoadingPosition(true);
                  try {
                    await dashboardService.captureFinancialPositionSnapshot(token);
                    await loadPositionHistory();
                  } finally {
                    setLoadingPosition(false);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingPosition ? 'animate-spin' : ''}`} />
                Capture Snapshot Now
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {bridge && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      Net Worth Change Bridge ({bridge.fromDate} → {bridge.toDate})
                    </span>
                    <span className={`font-mono font-extrabold text-base ${bridge.totalDeltaMad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {bridge.totalDeltaMad >= 0 ? '+' : ''}{bridge.totalDeltaMad.toFixed(2)} MAD
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    {[
                      { label: 'Liquid Cash', val: bridge.deltaLiquidCashMad },
                      { label: 'Credit / Overdraft', val: bridge.deltaCreditDebtMad },
                      { label: 'Receivables', val: bridge.deltaReceivablesMad },
                      { label: 'Payables', val: bridge.deltaPayablesMad },
                      { label: 'Investments', val: bridge.deltaInvestmentsMad },
                      { label: 'External Net', val: bridge.deltaExternalNetMad },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2">
                        <span className="text-[11px] text-gray-500">{item.label}</span>
                        <p className={`font-mono font-bold mt-0.5 ${item.val >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.val >= 0 ? '+' : ''}{item.val.toFixed(2)} MAD
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {snapshots.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  No snapshots captured yet. Click &ldquo;Capture Snapshot Now&rdquo; to record today&apos;s verified whole-financial position.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase">
                      <tr>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 px-3">Total Net Worth</th>
                        <th className="py-2 px-3">Liquid Net Worth</th>
                        <th className="py-2 px-3">Investments</th>
                        <th className="py-2 px-3">External Net</th>
                        <th className="py-2 pl-3">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {snapshots.slice(0, 20).map((s) => {
                        const extNet = Number(s.externalAssetsMad || 0) - Number(s.externalLiabilitiesMad || 0);
                        return (
                          <tr key={s.id}>
                            <td className="py-2 pr-3 font-mono font-semibold">{s.snapshotDate}</td>
                            <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                              {Number(s.totalNetWorthMad).toFixed(2)} MAD
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                              {Number(s.liquidNetWorthMad).toFixed(2)} MAD
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                              {Number(s.investmentMarketValueMad).toFixed(2)} MAD
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                              {extNet.toFixed(2)} MAD
                            </td>
                            <td className="py-2 pl-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                s.isEstimated
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {s.dataSource} · {s.confidenceLevel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export & Backup Sub-Tab */}
      {activeSubTab === 'export' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-0.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Spreadsheet Exports vs Full SQL Database Backup
              </p>
              <p className="text-indigo-700/80 dark:text-indigo-300/80">
                Use CSV/JSON below for spreadsheets &amp; reporting. For full relational database SQL dumps, validation &amp; restore, use Settings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onNavigateTab?.('settings')}
                className="text-xs whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5 mr-1.5" />
                Open SQL Backup &amp; Drive
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CSV Export Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                  <CardTitle>CSV Export (Universal Spreadsheet)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Download your full transaction history with UTF-8 BOM encoding and standard CRLF format, fully compatible with Google Sheets, Microsoft Excel, and Apple Numbers.
                </p>
                <div className="pt-2">
                  <Button onClick={handleExportCSV} className="w-full flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download CSV ({transactions.length} transactions)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* JSON Snapshot Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-purple-500" />
                  <CardTitle>JSON Snapshot (Full Context)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Download a comprehensive JSON snapshot of your current financial context, including all KPIs, budgets, settings, and transaction trees.
                </p>
                <div className="pt-2">
                  <Button onClick={handleExportJSON} variant="outline" className="w-full flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download JSON Snapshot
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Import CSV Sub-Tab */}
      {activeSubTab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-2xl mx-auto">
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
              <p className="font-semibold">Reconciling a Bank or Card Statement?</p>
              <p className="text-amber-800/80 dark:text-amber-300/80">
                This form bulk-adds spreadsheet rows directly. For bank CSV/TSV statements with row hashing, duplicate prevention &amp; variance checks, use Accounts Statement Import.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('truespend:openAccountsSection', { detail: 'statement_import' })
                )
              }
              className="text-xs whitespace-nowrap shrink-0 border-amber-300 dark:border-amber-800"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Open Statement Reconciliation
            </Button>
          </div>

          {importStatus && (
            <div className={`p-4 rounded-xl flex items-start gap-3 border ${
              importStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
            }`}>
              {importStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm font-medium">{importStatus.message}</div>
            </div>
          )}

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" />
                <CardTitle>Bulk Import Transactions from Spreadsheet CSV</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload transactions from a personal spreadsheet. The parser automatically detects headers: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200">Date, Type, Wallet, Category, Amount, Notes</code>.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="pt-2">
                {isImporting ? (
                  <div className="space-y-2">
                    <Button disabled className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {importProgress ? `Importing ${importProgress.current}/${importProgress.total}...` : 'Processing file...'}
                    </Button>
                    {importProgress && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-150"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Upload className="w-4 h-4" />
                    Select &amp; Import Spreadsheet CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
