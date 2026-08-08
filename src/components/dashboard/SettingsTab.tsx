import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

interface SettingsTabProps {
  emergencyBuffer: number;
  setEmergencyBuffer: (val: number) => void;
  payday: number;
  setPayday: (val: number) => void;
  isSaving: boolean;
  handleSaveSettings: (payday: number, buffer: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  emergencyBuffer,
  setEmergencyBuffer,
  payday,
  setPayday,
  isSaving,
  handleSaveSettings,
}) => {
  return (
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
  );
};
