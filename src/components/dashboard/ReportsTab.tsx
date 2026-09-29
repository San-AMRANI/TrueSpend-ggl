import React, { useState, useRef } from 'react';
import { Transaction, KPI, CategoryBudget } from '../../types';
import { FileBarChart, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { normalizeCategory } from '../../lib/categories';

interface ReportsTabProps {
  transactions: Transaction[];
  kpis: KPI | null;
  budgets: CategoryBudget[];
  onDataChange?: () => Promise<void> | void;
}

interface ParsedTransactionRow {
  date?: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: 'Bank' | 'Cash';
  category: string;
  amount: number;
  notes: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ transactions, kpis, budgets, onDataChange }) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExportCSV = () => {
    if (!transactions.length) {
      alert('No transactions to export.');
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-indigo-500" />
          Advanced Reporting & Data Transfer
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Generate, export, or import detailed financial records</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CSV Export Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              <CardTitle>CSV Export</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download your full transaction history with UTF-8 BOM encoding, fully compatible with Google Sheets, Microsoft Excel, and Apple Numbers.
            </p>
            <div className="pt-2">
              <Button onClick={handleExportCSV} className="w-full flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Download CSV ({transactions.length} items)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CSV Import Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-500" />
              <CardTitle>CSV Import</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Import transactions from a CSV spreadsheet. Columns recognized: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">Date, Type, Wallet, Category, Amount, Notes</code>.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            
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
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV File
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* JSON Export Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-purple-500" />
              <CardTitle>JSON Snapshot</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download a complete JSON snapshot of your current financial context, including all KPIs, budgets, and transactions.
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
  );
};
