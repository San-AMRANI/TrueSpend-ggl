import React from 'react';
import { CalculatorsHubTab } from './CalculatorsHubTab';
import { KPI, Transaction, Payroll, Debt, CategoryBudget, Goal, DashboardTab, UserSettings } from '../../types';

interface WhatIfTabProps {
  kpis: KPI | null;
  amount: number;
  setAmount: (amount: number) => void;
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals?: Goal[];
  userSettings?: UserSettings | null;
  onNavigateToTab?: (tab: DashboardTab) => void;
  onCreateGoal?: (payload: any) => Promise<any>;
  onSaveCategoryBudget?: (category: string, year: number, month: number, amount: number) => Promise<any>;
  onSaveSettings?: (settings: Partial<UserSettings>) => Promise<any>;
}

export const WhatIfTab: React.FC<WhatIfTabProps> = (props) => {
  return <CalculatorsHubTab {...props} />;
};
