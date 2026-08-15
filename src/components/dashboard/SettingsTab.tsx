import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Database, Download, Moon, Sun, Monitor, Upload } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface SettingsTabProps {
  emergencyBuffer: number;
  setEmergencyBuffer: (val: number) => void;
  payday: number;
  setPayday: (val: number) => void;
  salary: number;
  setSalary: (val: number) => void;
  isSaving: boolean;
  isExporting?: boolean;
  isImporting?: boolean;
  handleSaveSettings: (payday: number, buffer: number, salary: number) => void;
  handleExportSql?: () => void;
  handleImportSql?: (sql: string) => Promise<{ message: string }>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  emergencyBuffer,
  setEmergencyBuffer,
  payday,
  setPayday,
  salary,
  setSalary,
  isSaving,
  isExporting = false,
  isImporting = false,
  handleSaveSettings,
  handleExportSql,
  handleImportSql,
}) => {
  const { theme, setTheme } = useTheme();
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !handleImportSql) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('This backup is larger than the 10 MB import limit.');
      return;
    }

    const sql = await file.text();
    if (!sql.slice(0, 500).includes('-- TrueSpend Complete PostgreSQL Database Backup')) {
      alert('Please select a SQL backup exported by TrueSpend.');
      return;
    }

    if (!confirm('Restore this backup? All current TrueSpend data will be permanently replaced. Export a new backup first if you need the current data.')) return;

    try {
      const result = await handleImportSql(sql);
      alert(result.message);
    } catch (error: any) {
      console.error('SQL import failed:', error);
      alert(error?.message || 'Could not import the SQL backup. Your existing data was not changed.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Appearance</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose between light and dark mode, or sync with your system.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'system'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800/50 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  System
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Emergency Liquidity Buffer</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Keep a safety cushion. This amount will be excluded from your daily allowance calculation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={emergencyBuffer}
                  onChange={(e) => setEmergencyBuffer(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Buffer amount"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Payroll Settings</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                Set your payroll date and expected salary to automatically deposit your salary into your bank account on payday.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Payday (Date)</label>
                  <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Monthly Salary Amount</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                    placeholder="Salary amount"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={isSaving} onClick={() => handleSaveSettings(payday, emergencyBuffer, salary)}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Data Backup & SQL Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Export Database as SQL</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Download a full TrueSpend PostgreSQL database backup, not just the current user’s data.
              The export contains every stored record and table schema (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">users</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">transactions</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">debts</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">splits</code>, and <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">category_budgets</code>), custom enum types, categories, and structured INSERT statements. Restore it into a new or empty PostgreSQL database.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                disabled={isExporting}
                onClick={handleExportSql}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white border-gray-300 dark:border-gray-700"
              >
                <Download className="h-4 w-4 text-blue-600" />
                {isExporting ? 'Generating SQL Export...' : 'Export Data as SQL (.sql)'}
              </Button>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Restore from SQL Backup</h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Choose a <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">.sql</code> file exported by TrueSpend. The backup is validated before a single transaction replaces the current records, so a failed import leaves your data unchanged.
              </p>
              <input ref={importFileRef} type="file" accept=".sql,application/sql,text/plain" onChange={handleImportFile} className="hidden" />
              <div className="pt-3">
                <Button
                  variant="outline"
                  disabled={isImporting}
                  onClick={() => importFileRef.current?.click()}
                  className="flex items-center gap-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Restoring Backup...' : 'Import & Restore SQL Backup'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
