import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Database, Download } from 'lucide-react';

interface SettingsTabProps {
  emergencyBuffer: number;
  setEmergencyBuffer: (val: number) => void;
  payday: number;
  setPayday: (val: number) => void;
  isSaving: boolean;
  isExporting?: boolean;
  handleSaveSettings: (payday: number, buffer: number) => void;
  handleExportSql?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  emergencyBuffer,
  setEmergencyBuffer,
  payday,
  setPayday,
  isSaving,
  isExporting = false,
  handleSaveSettings,
  handleExportSql,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Emergency Liquidity Buffer</h3>
              <p className="text-sm text-gray-500 mb-4">
                Keep a safety cushion. This amount will be excluded from your daily allowance calculation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={emergencyBuffer}
                  onChange={(e) => setEmergencyBuffer(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Buffer amount"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Payroll Date (Payday)</h3>
              <p className="text-sm text-blue-600 mb-4">
                Select the day of the month you usually get paid. This resets your monthly pacing KPIs.
              </p>
              <div className="flex items-center gap-3">
                <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={isSaving} onClick={() => handleSaveSettings(payday, emergencyBuffer)}>
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
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Export Database as SQL</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Download a full TrueSpend PostgreSQL database backup, not just the current user’s data.
              The export contains every stored record and table schema (<code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">users</code>,{' '}
              <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">transactions</code>,{' '}
              <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">debts</code>,{' '}
              <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">splits</code>, and <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">category_budgets</code>), custom enum types, categories, and structured INSERT statements. Restore it into a new or empty PostgreSQL database.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                disabled={isExporting}
                onClick={handleExportSql}
                className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 border-gray-300"
              >
                <Download className="h-4 w-4 text-blue-600" />
                {isExporting ? 'Generating SQL Export...' : 'Export Data as SQL (.sql)'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
