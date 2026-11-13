import React from 'react';
import {
  LayoutDashboard,
  Landmark,
  ArrowRightLeft,
  WalletCards,
  TrendingUp,
  Sparkles,
  Calculator,
  CalendarDays,
  BarChart2,
  FileBarChart,
  Map,
  Repeat,
  Target,
  Users,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import type { DashboardTab } from '../types';
import { SpexAvatar } from '../components/common/SpexAvatar';

export type NavGroupId =
  | 'home'
  | 'money'
  | 'commitments'
  | 'planning'
  | 'intelligence'
  | 'administration';

export interface NavItemConfig {
  id: DashboardTab;
  label: string;
  shortLabel: string;
  group: NavGroupId;
  groupLabel: string;
  placement: 'primary' | 'more' | 'settings';
  quickMobile?: boolean;
  description: string;
  keywords: string;
  icon: React.FC<{ className?: string }>;
}

const SpexNavIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) =>
  React.createElement(
    'span',
    { className: `inline-flex items-center justify-center shrink-0 pointer-events-none ${className}` },
    React.createElement(SpexAvatar, { className: 'w-full h-full', clickable: false })
  );

export const NAV_GROUP_ORDER: { id: NavGroupId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'money', label: 'Money & Accounts' },
  { id: 'commitments', label: 'Commitments & Budgets' },
  { id: 'planning', label: 'Planning & Forecasting' },
  { id: 'intelligence', label: 'Intelligence & Reports' },
  { id: 'administration', label: 'Administration' },
];

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    group: 'home',
    groupLabel: 'Home',
    placement: 'primary',
    quickMobile: true,
    description: 'Safe-to-spend, daily allowance, health score & operational radar',
    keywords: 'home dashboard overview safe to spend kpi',
    icon: LayoutDashboard,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    shortLabel: 'Accounts',
    group: 'money',
    groupLabel: 'Money & Accounts',
    placement: 'primary',
    quickMobile: true,
    description: 'Wallets, credit liabilities, statement CSV import, review inbox & double-entry journal',
    keywords: 'accounts wallets bank cash credit card statement import review inbox journal fx counterparties integrity',
    icon: Landmark,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    shortLabel: 'Transactions',
    group: 'money',
    groupLabel: 'Money & Accounts',
    placement: 'primary',
    quickMobile: true,
    description: 'Authoritative activity history with native FX & reimbursement filters',
    keywords: 'transactions ledger history expenses income transfers fx',
    icon: ArrowRightLeft,
  },
  {
    id: 'investments',
    label: 'Stocks & Equities',
    shortLabel: 'Stocks',
    group: 'money',
    groupLabel: 'Money & Accounts',
    placement: 'primary',
    description: 'US/BVC equities, Binance multi-wallet, dividends & cost basis',
    keywords: 'stocks equities investments portfolio dividends binance bvc us',
    icon: TrendingUp,
  },
  {
    id: 'budgets',
    label: 'Budgets',
    shortLabel: 'Budgets',
    group: 'commitments',
    groupLabel: 'Commitments & Budgets',
    placement: 'primary',
    description: 'Category caps, envelopes, 50/30/20, rollover & Spex AI planning',
    keywords: 'budgets envelope 50 30 20 categories limit auto budget',
    icon: WalletCards,
  },
  {
    id: 'calendar',
    label: 'Calendar & Cash Flow',
    shortLabel: 'Calendar',
    group: 'commitments',
    groupLabel: 'Commitments & Budgets',
    placement: 'primary',
    description: 'Payday confirmation, scheduled commitments & daily cash runway',
    keywords: 'calendar cash flow payday schedule payroll commitments',
    icon: CalendarDays,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    shortLabel: 'Subs',
    group: 'commitments',
    groupLabel: 'Commitments & Budgets',
    placement: 'more',
    description: 'Recurring bills, templates, billing cycles & auto-detection',
    keywords: 'subscriptions recurring bills netflix spotify pruner',
    icon: Repeat,
  },
  {
    id: 'debts',
    label: 'Debts & Splits',
    shortLabel: 'Debts',
    group: 'commitments',
    groupLabel: 'Commitments & Budgets',
    placement: 'more',
    description: 'Receivables, payables, APR amortization, settlements & bill splits',
    keywords: 'debts receivables payables owed iou splits apr loan amortization',
    icon: Users,
  },
  {
    id: 'goals',
    label: 'Goals',
    shortLabel: 'Goals',
    group: 'planning',
    groupLabel: 'Planning & Forecasting',
    placement: 'more',
    description: 'Savings targets, mirrored vaults, slices & contribution audit trail',
    keywords: 'goals savings target emergency fund contribution events',
    icon: Target,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    shortLabel: 'Forecast',
    group: 'planning',
    groupLabel: 'Planning & Forecasting',
    placement: 'primary',
    description: '30-day cash runway, 24-month trajectory & calibration metrics',
    keywords: 'forecast predictive trajectory runway future calibration',
    icon: Sparkles,
  },
  {
    id: 'calculators',
    label: 'Simulators',
    shortLabel: 'Simulators',
    group: 'planning',
    groupLabel: 'Planning & Forecasting',
    placement: 'primary',
    description: 'Saved What-If scenario comparisons, Moroccan IGR/CNSS tax & loan payoffs',
    keywords: 'calculators what if simulator scenario comparison loan mortgage tax salary igr cnss inflation split',
    icon: Calculator,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    group: 'intelligence',
    groupLabel: 'Intelligence & Reports',
    placement: 'more',
    description: 'Net vs gross spending, weekday heatmap, FX exposure & merchant insights',
    keywords: 'analytics charts merchants categories trends heatmap fx',
    icon: BarChart2,
  },
  {
    id: 'reports',
    label: 'Reports & Retro',
    shortLabel: 'Reports',
    group: 'intelligence',
    groupLabel: 'Intelligence & Reports',
    placement: 'more',
    description: 'AI cycle retrospective, Net Worth bridge & spreadsheet CSV/JSON export',
    keywords: 'reports retrospective grade export import csv json net worth bridge position',
    icon: FileBarChart,
  },
  {
    id: 'contexts',
    label: 'Contexts',
    shortLabel: 'Contexts',
    group: 'intelligence',
    groupLabel: 'Intelligence & Reports',
    placement: 'more',
    description: 'Trips, projects, missions and event-scoped budgets',
    keywords: 'contexts trips projects events',
    icon: Map,
  },
  {
    id: 'chat',
    label: 'Spex AI',
    shortLabel: 'Spex AI',
    group: 'intelligence',
    groupLabel: 'Intelligence & Reports',
    placement: 'primary',
    quickMobile: true,
    description: 'Financial assistant with impact simulation before action approval',
    keywords: 'ai spex chat assistant simulate actions copilot',
    icon: SpexNavIcon,
  },
  {
    id: 'users',
    label: 'Users & Roles',
    shortLabel: 'Users',
    group: 'administration',
    groupLabel: 'Administration',
    placement: 'more',
    description: 'Workspace members, RBAC permissions & audit activity logs',
    keywords: 'users roles permissions admin audit rbac',
    icon: ShieldCheck,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    group: 'administration',
    groupLabel: 'Administration',
    placement: 'settings',
    description: 'Profile, theme studio, notification engine, SQL/Drive backups & rules engine',
    keywords: 'settings backup sql google drive notifications rules offline outbox themes',
    icon: Settings,
  },
];
