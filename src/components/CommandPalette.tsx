import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  Calculator,
  CalendarDays,
  ArrowRightLeft,
  WalletCards,
  BarChart2,
  FileBarChart,
  Map,
  Repeat,
  Target,
  Users,
  ShieldCheck,
  Settings,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Moon,
  Sun,
  X,
  CornerDownLeft,
  Landmark,
  Banknote,
  Bot,
  Palette,
} from 'lucide-react';
import {
  DashboardTab,
  KPI,
  Transaction,
  Debt,
  Goal,
  Subscription,
  InvestmentsData,
} from '../types';
import { useTheme, THEME_PRESETS } from '../context/ThemeContext';
import { format } from 'date-fns';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (id: string) => void;
  onOpenQuickTransaction: (initialType: 'Expense' | 'Income' | 'Transfer') => void;
  onOpenSmartCalculator: () => void;
  onOpenWalletsModal: () => void;
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  goals: Goal[];
  subscriptions: Subscription[];
  investmentsData: InvestmentsData | null;
}

interface CommandItem {
  id: string;
  group: 'Quick Actions' | 'Navigation' | 'Wallets' | 'Recent Transactions' | 'Goals & Subscriptions' | 'Equities';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.FC<{ className?: string }>;
  onSelect: () => void;
  keywords?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  openTransaction,
  onOpenQuickTransaction,
  onOpenSmartCalculator,
  onOpenWalletsModal,
  kpis,
  transactions,
  debts,
  goals,
  subscriptions,
  investmentsData,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // 1. Quick Actions
      {
        id: 'act-log-expense',
        group: 'Quick Actions',
        title: 'Log New Expense',
        subtitle: 'Record a purchase or bill payment immediately',
        badge: 'Action',
        badgeColor: 'text-rose-600 dark:text-rose-400',
        icon: ArrowUpRight,
        keywords: 'add create spend expense buy transaction',
        onSelect: () => {
          onClose();
          onOpenQuickTransaction('Expense');
        },
      },
      {
        id: 'act-log-income',
        group: 'Quick Actions',
        title: 'Log New Income',
        subtitle: 'Record salary, freelance inflow, or reimbursement',
        badge: 'Action',
        badgeColor: 'text-emerald-600 dark:text-emerald-400',
        icon: ArrowDownRight,
        keywords: 'add create income salary deposit money',
        onSelect: () => {
          onClose();
          onOpenQuickTransaction('Income');
        },
      },
      {
        id: 'act-log-transfer',
        group: 'Quick Actions',
        title: 'Transfer Between Wallets',
        subtitle: 'Move money between Bank, Cash, Savings, or Brokerage',
        badge: 'Action',
        badgeColor: 'text-blue-600 dark:text-blue-400',
        icon: RefreshCw,
        keywords: 'transfer move bank cash wallet withdraw',
        onSelect: () => {
          onClose();
          onOpenQuickTransaction('Transfer');
        },
      },
      {
        id: 'act-smart-calc',
        group: 'Quick Actions',
        title: 'Open Tactile Smart Calculator',
        subtitle: 'Calculate expressions with live Safe-to-Spend & Work-Hour telemetry',
        badge: 'Tool',
        badgeColor: 'text-indigo-600 dark:text-indigo-400',
        icon: Calculator,
        keywords: 'calculator math work hours compound',
        onSelect: () => {
          onClose();
          onOpenSmartCalculator();
        },
      },
      {
        id: 'act-reconcile-wallets',
        group: 'Quick Actions',
        title: 'Manage & Reconcile Wallets',
        subtitle: `Total Liquidity: ${(kpis?.totalLiquidity ?? 0).toFixed(2)} MAD across ${kpis?.accounts?.length ?? 0} accounts`,
        badge: 'Wallets',
        badgeColor: 'text-indigo-600 dark:text-indigo-400',
        icon: WalletCards,
        keywords: 'reconcile balance bank cash wallet adjust',
        onSelect: () => {
          onClose();
          onOpenWalletsModal();
        },
      },
      {
        id: 'act-spex-audit',
        group: 'Quick Actions',
        title: 'Run Spex AI Financial Health Audit',
        subtitle: 'Launch Spex AI with an instant cycle diagnostic',
        badge: 'AI Agent',
        badgeColor: 'text-purple-600 dark:text-purple-400',
        icon: Bot,
        keywords: 'ai spex audit health checkup copilot',
        onSelect: () => {
          onClose();
          setActiveTab('chat');
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('truespend:sendChatPrompt', {
                detail: { prompt: 'Run a complete financial health audit and cash flow checkup' },
              })
            );
          }, 120);
        },
      },
      ...THEME_PRESETS.map((preset) => ({
        id: `act-theme-${preset.id}`,
        group: 'Quick Actions' as const,
        title: `Apply Theme: ${preset.name}`,
        subtitle: `${preset.tagline} · ${preset.defaultFontLabel}`,
        badge: theme === preset.id ? 'Active Theme' : 'Theme',
        badgeColor: 'text-indigo-600 dark:text-indigo-400',
        icon: Palette,
        keywords: `theme style appearance ${preset.id} ${preset.name.toLowerCase()} ${preset.tagline.toLowerCase()} ${preset.eraOrStyle.toLowerCase()} ${preset.mode} vintage dark light terminal emerald espresso sahara terracotta kyoto matcha rose gold tokyo cyber wall street abyss navy`,
        onSelect: () => {
          setTheme(preset.id);
          onClose();
        },
      })),

      // 2. Navigation
      {
        id: 'nav-overview',
        group: 'Navigation',
        title: 'Overview Command Center',
        subtitle: `Safe to Spend: ${(kpis?.safeToSpend ?? 0).toFixed(0)} MAD · Health: ${kpis?.healthScore ?? 0}/100`,
        icon: LayoutDashboard,
        keywords: 'home dashboard overview safe to spend',
        onSelect: () => {
          setActiveTab('overview');
          onClose();
        },
      },
      {
        id: 'nav-calculators',
        group: 'Navigation',
        title: 'Calculators & What-If Simulators Hub',
        subtitle: 'Affordability, Loan Payoff, Moroccan Salary Tax (IGR/CNSS), Inflation & Bill Split',
        icon: Calculator,
        keywords: 'calculators what if simulator loan mortgage tax salary igr cnss inflation split',
        onSelect: () => {
          setActiveTab('calculators');
          onClose();
        },
      },
      {
        id: 'nav-forecast',
        group: 'Navigation',
        title: 'Predictive Forecast & Trajectory',
        subtitle: '30-day cash runway, 24-month net worth projection & category exhaustion radar',
        icon: Sparkles,
        keywords: 'forecast predictive trajectory runway future',
        onSelect: () => {
          setActiveTab('forecast');
          onClose();
        },
      },
      {
        id: 'nav-investments',
        group: 'Navigation',
        title: 'Stocks & Equities Portfolio',
        subtitle: `Portfolio Value: ${(investmentsData?.totalPortfolioValueMad ?? 0).toFixed(0)} MAD`,
        icon: TrendingUp,
        keywords: 'stocks equities investments portfolio dividends bvc us',
        onSelect: () => {
          setActiveTab('investments');
          onClose();
        },
      },
      {
        id: 'nav-transactions',
        group: 'Navigation',
        title: 'Transactions Ledger',
        subtitle: `${transactions.length} recorded transactions`,
        icon: ArrowRightLeft,
        keywords: 'transactions ledger history expenses income',
        onSelect: () => {
          setActiveTab('transactions');
          onClose();
        },
      },
      {
        id: 'nav-budgets',
        group: 'Navigation',
        title: 'Budgets & 50/30/20 Planner',
        subtitle: 'Category caps, Envelope view, and macro rule benchmarks',
        icon: WalletCards,
        keywords: 'budgets envelope 50 30 20 categories limit',
        onSelect: () => {
          setActiveTab('budgets');
          onClose();
        },
      },
      {
        id: 'nav-calendar',
        group: 'Navigation',
        title: 'Financial Calendar & Cash Flow',
        subtitle: 'Payday schedule, recurring bills, and daily balance timeline',
        icon: CalendarDays,
        keywords: 'calendar cash flow payday schedule payroll',
        onSelect: () => {
          setActiveTab('calendar');
          onClose();
        },
      },
      {
        id: 'nav-subscriptions',
        group: 'Navigation',
        title: 'Subscriptions & Fixed Commitments Radar',
        subtitle: `${subscriptions.filter((s) => s.status === 'active').length} active recurring bills`,
        icon: Repeat,
        keywords: 'subscriptions recurring bills netflix spotify pruner',
        onSelect: () => {
          setActiveTab('subscriptions');
          onClose();
        },
      },
      {
        id: 'nav-goals',
        group: 'Navigation',
        title: 'Savings Goals & Milestones',
        subtitle: `${goals.length} active savings targets`,
        icon: Target,
        keywords: 'goals savings target emergency fund',
        onSelect: () => {
          setActiveTab('goals');
          onClose();
        },
      },
      {
        id: 'nav-debts',
        group: 'Navigation',
        title: 'Debts, Receivables & Splits',
        subtitle: `${debts.filter((d) => d.status === 'Pending').length} pending debt records`,
        icon: Users,
        keywords: 'debts receivables payables owed iou splits',
        onSelect: () => {
          setActiveTab('debts');
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        group: 'Navigation',
        title: 'Deep Spending Analytics & Merchants',
        subtitle: 'Category breakdowns, merchant intelligence, and month-over-month trends',
        icon: BarChart2,
        keywords: 'analytics charts merchants categories trends',
        onSelect: () => {
          setActiveTab('analytics');
          onClose();
        },
      },
      {
        id: 'nav-reports',
        group: 'Navigation',
        title: 'Cycle Report Card & Data Sovereignty',
        subtitle: 'AI cycle retrospective grade, CSV/JSON export & import',
        icon: FileBarChart,
        keywords: 'reports retrospective grade export import csv json',
        onSelect: () => {
          setActiveTab('reports');
          onClose();
        },
      },
      {
        id: 'nav-contexts',
        group: 'Navigation',
        title: 'Financial Contexts & Projects',
        subtitle: 'Track Trips, Missions, Life Events, and dedicated project budgets',
        icon: Map,
        keywords: 'contexts trips projects events',
        onSelect: () => {
          setActiveTab('contexts');
          onClose();
        },
      },
      {
        id: 'nav-users',
        group: 'Navigation',
        title: 'Users, Roles & Access Control',
        subtitle: 'Manage workspace members, permissions, and audit logs',
        icon: ShieldCheck,
        keywords: 'users roles permissions admin audit',
        onSelect: () => {
          setActiveTab('users');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        title: 'Settings, Cloud Backups & Notifications',
        subtitle: 'Payday, salary, emergency buffer, Google Drive & SQL backup',
        icon: Settings,
        keywords: 'settings backup sql google drive notifications',
        onSelect: () => {
          setActiveTab('settings');
          onClose();
        },
      },
    ];

    // 3. Wallets
    (kpis?.accounts || []).forEach((w) => {
      items.push({
        id: `wallet-${w.id}`,
        group: 'Wallets',
        title: `${w.name} (${w.type})`,
        subtitle: `Current Balance: ${w.balance.toFixed(2)} MAD`,
        badge: `${w.balance.toFixed(0)} MAD`,
        icon: w.type === 'Bank' ? Landmark : w.type === 'Cash' ? Banknote : WalletCards,
        keywords: `wallet ${w.name} ${w.type}`,
        onSelect: () => {
          onClose();
          onOpenWalletsModal();
        },
      });
    });

    // 4. Recent / Searchable Transactions
    transactions.slice(0, 60).forEach((tx) => {
      const amt = parseFloat(tx.amount) || 0;
      const dateLabel = format(new Date(tx.createdAt), 'MMM d, yyyy');
      items.push({
        id: `tx-${tx.id}`,
        group: 'Recent Transactions',
        title: tx.notes || tx.category || tx.type,
        subtitle: `${dateLabel} · ${tx.category || tx.type}`,
        badge: `${tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : ''}${amt.toFixed(2)} MAD`,
        badgeColor:
          tx.type === 'Income'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tx.type === 'Expense'
            ? 'text-gray-900 dark:text-gray-100'
            : 'text-blue-600 dark:text-blue-400',
        icon: tx.type === 'Income' ? ArrowDownRight : tx.type === 'Transfer' ? RefreshCw : ArrowUpRight,
        keywords: `${tx.notes || ''} ${tx.category || ''} ${amt} ${dateLabel}`,
        onSelect: () => {
          onClose();
          openTransaction(tx.id);
        },
      });
    });

    // 5. Goals & Subscriptions
    goals.forEach((g) => {
      const cur = parseFloat(g.currentAmount) || 0;
      const tgt = parseFloat(g.targetAmount) || 0;
      items.push({
        id: `goal-${g.id}`,
        group: 'Goals & Subscriptions',
        title: `Goal: ${g.name}`,
        subtitle: `${cur.toLocaleString()} / ${tgt.toLocaleString()} MAD (${tgt > 0 ? ((cur / tgt) * 100).toFixed(0) : 0}%)`,
        badge: g.category || 'Goal',
        icon: Target,
        keywords: `goal ${g.name} ${g.category}`,
        onSelect: () => {
          setActiveTab('goals');
          onClose();
        },
      });
    });

    subscriptions.forEach((s) => {
      items.push({
        id: `sub-${s.id}`,
        group: 'Goals & Subscriptions',
        title: `Subscription: ${s.name}`,
        subtitle: `${parseFloat(s.amount).toFixed(0)} MAD / ${s.billingCycle} · ${s.status}`,
        badge: `${parseFloat(s.amount).toFixed(0)} MAD`,
        icon: Repeat,
        keywords: `subscription recurring ${s.name} ${s.category}`,
        onSelect: () => {
          setActiveTab('subscriptions');
          onClose();
        },
      });
    });

    // 6. Equities
    (investmentsData?.positions || []).forEach((pos) => {
      items.push({
        id: `stock-${pos.id}`,
        group: 'Equities',
        title: `${pos.ticker} — ${pos.companyName}`,
        subtitle: `${pos.sharesNum} shares · Value: ${pos.marketValueMad.toFixed(0)} MAD`,
        badge: `${pos.unrealizedPnlPercent >= 0 ? '+' : ''}${pos.unrealizedPnlPercent.toFixed(1)}%`,
        badgeColor:
          pos.unrealizedPnlPercent >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400',
        icon: TrendingUp,
        keywords: `stock equity ${pos.ticker} ${pos.companyName} ${pos.sector}`,
        onSelect: () => {
          setActiveTab('investments');
          onClose();
        },
      });
    });

    return items;
  }, [
    kpis,
    transactions,
    debts,
    goals,
    subscriptions,
    investmentsData,
    theme,
    onClose,
    onOpenQuickTransaction,
    onOpenSmartCalculator,
    onOpenWalletsModal,
    setActiveTab,
    openTransaction,
    setTheme,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default view when empty: Quick Actions + Navigation + top 4 recent transactions
      return allItems.filter(
        (item) =>
          item.group === 'Quick Actions' ||
          item.group === 'Navigation' ||
          (item.group === 'Recent Transactions' && allItems.indexOf(item) < 28)
      );
    }

    return allItems
      .filter((item) => {
        const haystack = `${item.title} ${item.subtitle || ''} ${item.keywords || ''} ${item.group}`.toLowerCase();
        return q.split(/\s+/).every((word) => haystack.includes(word));
      })
      .slice(0, 30);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
        );
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].onSelect();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  // Group filtered items for clean presentation
  const groups = Array.from(new Set(filteredItems.map((i) => i.group)));

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 pt-12 sm:pt-20 animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-3.5">
          <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, wallets, stocks, calculators, or type a command..."
            className="w-full bg-transparent text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[11px] font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[65vh] overflow-y-auto p-2 divide-y divide-gray-100 dark:divide-gray-800/60">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                No matching commands, transactions, or accounts found
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Try searching for "calculator", "groceries", "salary", or "audit"
              </p>
            </div>
          ) : (
            groups.map((groupName) => {
              const groupItems = filteredItems.filter((i) => i.group === groupName);
              return (
                <div key={groupName} className="py-2 first:pt-1 last:pb-1">
                  <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 dark:text-gray-500">
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {groupItems.map((item) => {
                      const flatIdx = filteredItems.indexOf(item);
                      const isSelected = flatIdx === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(flatIdx)}
                          onClick={item.onSelect}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                isSelected
                                  ? 'border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400'
                                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className={`text-xs font-mono tabular-nums font-semibold ${
                                  item.badgeColor || 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                            {isSelected && (
                              <CornerDownLeft className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/90 px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              <strong className="font-mono text-gray-700 dark:text-gray-300">↑↓</strong> Navigate
            </span>
            <span>·</span>
            <span>
              <strong className="font-mono text-gray-700 dark:text-gray-300">↵</strong> Execute
            </span>
            <span>·</span>
            <span>
              <strong className="font-mono text-gray-700 dark:text-gray-300">ESC</strong> Close
            </span>
          </div>
          <span className="font-mono tabular-nums">
            Safe to Spend: {(kpis?.safeToSpend ?? 0).toFixed(0)} MAD
          </span>
        </div>
      </div>
    </div>
  );
};
