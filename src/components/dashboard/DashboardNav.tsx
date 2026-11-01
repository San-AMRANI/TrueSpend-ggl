import React, { useEffect, useRef, useState } from 'react';
import { DashboardTab } from '../../types';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Users,
  BarChart2,
  Settings,
  WalletCards,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Map,
  Target,
  Repeat,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Calculator,
  LayoutGrid,
  X,
} from 'lucide-react';
import { SpexAvatar } from '../common/SpexAvatar';

interface DashboardNavProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const SpexNavIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <span className={`inline-flex items-center justify-center shrink-0 pointer-events-none ${className}`}>
    <SpexAvatar className="w-full h-full" clickable={false} />
  </span>
);

const tabs: {
  id: DashboardTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'investments', label: 'Stocks & Equities', shortLabel: 'Stocks', icon: TrendingUp },
  { id: 'forecast', label: 'Predictive Forecast', shortLabel: 'Forecast', icon: Sparkles },
  { id: 'calculators', label: 'Calculators & Simulators', shortLabel: 'Simulators', icon: Calculator },
  { id: 'calendar', label: 'Calendar & Cash Flow', shortLabel: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart2 },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Transactions', icon: ArrowRightLeft },
  { id: 'budgets', label: 'Budgets', shortLabel: 'Budgets', icon: WalletCards },
  { id: 'subscriptions', label: 'Subscriptions', shortLabel: 'Subs', icon: Repeat },
  { id: 'contexts', label: 'Contexts', shortLabel: 'Contexts', icon: Map },
  { id: 'goals', label: 'Goals', shortLabel: 'Goals', icon: Target },
  { id: 'debts', label: 'Debts & Splits', shortLabel: 'Debts', icon: Users },
  { id: 'reports', label: 'Reports & Retrospective', shortLabel: 'Reports', icon: FileBarChart },
  { id: 'users', label: 'Users & Roles', shortLabel: 'Users', icon: ShieldCheck },
  { id: 'chat', label: 'Spex AI Chat', shortLabel: 'Spex AI', icon: SpexNavIcon },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const quickTabIds: DashboardTab[] = ['overview', 'investments', 'transactions', 'chat'];

export const DashboardNav: React.FC<DashboardNavProps> = ({ activeTab, setActiveTab }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const close = () => setIsExpanded(false);
  const open = () => setIsExpanded(true);
  const chooseTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    close();
  };

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartY.current === null) return;
    const movement = touchStartY.current - event.changedTouches[0].clientY;
    touchStartY.current = null;
    if (movement > 28) open();
    if (movement < -28) close();
  };

  const renderTab = (tab: (typeof tabs)[number], compact = false) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => chooseTab(tab.id)}
        className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[10px] font-medium leading-tight transition-colors ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800/60'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 active:bg-gray-100 dark:active:bg-gray-800'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
        <span className="max-w-full truncate">{compact ? tab.shortLabel : tab.label}</span>
      </button>
    );
  };

  const activeNonQuickTab = !quickTabIds.includes(activeTab)
    ? tabs.find((t) => t.id === activeTab)
    : undefined;

  return (
    <>
      {/* Backdrop when expanded on phone */}
      {isExpanded && activeTab !== 'chat' && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden animate-in fade-in duration-150"
          onClick={close}
        />
      )}

      <nav
        aria-label="Mobile dashboard navigation"
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0].clientY;
        }}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-x-0 bottom-0 z-50 m-0 border-t border-gray-200 dark:border-gray-800 bg-white/98 dark:bg-gray-900/98 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden transition-transform duration-200 ${
          activeTab === 'chat' ? 'translate-y-full pointer-events-none' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto max-w-lg">
          {/* Drag / Tap Handle */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse navigation menu' : 'Expand all 16 navigation pages'}
            onClick={() => (isExpanded ? close() : open())}
            className="flex h-5 w-full items-center justify-center gap-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <span className="h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-700" />
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>

          {isExpanded ? (
            <div className="max-h-[72vh] overflow-y-auto overscroll-contain pb-2 pt-1 animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between px-1.5 pb-2 mb-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  All Pages ({tabs.length})
                </span>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {tabs.map((tab) => renderTab(tab, true))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {tabs
                .filter((tab) => quickTabIds.includes(tab.id))
                .map((tab) => renderTab(tab, true))}

              {/* 5th Item: Active Non-Quick Tab or "More / All Pages" Toggle */}
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={open}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[10px] font-medium leading-tight transition-colors ${
                  activeNonQuickTab
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800/60'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                }`}
              >
                {activeNonQuickTab ? (
                  <>
                    <activeNonQuickTab.icon className="h-5 w-5 shrink-0 stroke-[2.5]" />
                    <span className="max-w-full truncate">{activeNonQuickTab.shortLabel}</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-5 w-5 shrink-0" />
                    <span className="max-w-full truncate">More</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};
