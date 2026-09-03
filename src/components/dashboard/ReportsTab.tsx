import React from 'react';
import { Transaction, KPI, CategoryBudget } from '../../types';
import { FileBarChart, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

interface ReportsTabProps {
  transactions: Transaction[];
  kpis: KPI | null;
  budgets: CategoryBudget[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ transactions, kpis, budgets }) => {
  const handleExportCSV = () => {
    if (!transactions.length) return alert('No transactions to export.');
    
    const headers = ['Date', 'Type', 'Wallet', 'Category', 'Amount', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(t => [
        t.createdAt.split('T')[0],
        t.type,
        t.sourceWallet,
        t.category || '',
        t.amount,
        `"${t.notes || ''}"`
      ].join(','))
    ].join('\\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TrueSpend_Transactions_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    link.setAttribute('download', 'TrueSpend_Financial_Report.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-indigo-500" />
          Advanced Reporting
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Generate and export detailed financial reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CSV Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download your complete transaction history as a CSV file, ready for Excel or Google Sheets.
            </p>
            <Button onClick={handleExportCSV} className="w-full flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>JSON Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download a complete snapshot of your current financial context, including KPIs, budgets, and transactions.
            </p>
            <Button onClick={handleExportJSON} variant="outline" className="w-full flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Download JSON Snapshot
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
