import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DashboardTab } from '../../types';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Users,
  BarChart2,
  FileText,
  Settings,
  Calculator,
  WalletCards,
  CalendarDays,
  ChevronDown,
  Bot,
  FileBarChart,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react';

interface DesktopHeaderNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

interface NavTabItem {
  id: DashboardTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const mainTabs: NavTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'cash-flow', label: 'Cash Flow', icon: TrendingUp },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
  { id: 'budgets', label: 'Budgets', icon: WalletCards },
];

const moreTabs: NavTabItem[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'debts', label: 'Debts & Splits', icon: Users },
  { id: 'what-if', label: 'What-If', icon: Calculator },
  { id: 'digest', label: 'Digest', icon: FileText },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'chat', label: 'AI Chat', icon: Bot },
];

export const DesktopHeaderNav: React.FC<DesktopHeaderNavProps> = ({ activeTab, onSelectTab }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isMoreActive = moreTabs.some((t) => t.id === activeTab);
  const activeMoreTab = moreTabs.find((t) => t.id === activeTab);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav aria-label="Desktop Navigation" className="hidden md:flex items-center gap-1">
      {/* Main Tabs */}
      {mainTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isActive
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="header-active-tab"
                className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className={`h-4 w-4 ${isActive ? 'stroke-[2.5]' : ''}`} />
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* More Dropdown */}
      <div className="relative" ref={moreMenuRef}>
        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            isMoreActive || isMoreOpen
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
          }`}
        >
          {isMoreActive && !isMoreOpen && (
            <motion.div
              layoutId="header-active-tab"
              className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 rounded-lg"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
            {activeMoreTab ? (
              <>
                <activeMoreTab.icon className="h-4 w-4 stroke-[2.5]" />
                <span>{activeMoreTab.label}</span>
              </>
            ) : (
              <>
                <MoreHorizontal className="h-4 w-4" />
                <span>More</span>
              </>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {isMoreOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(tab.id);
                    setIsMoreOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Tab */}
      <button
        type="button"
        aria-current={activeTab === 'settings' ? 'page' : undefined}
        onClick={() => onSelectTab('settings')}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          activeTab === 'settings'
            ? 'text-indigo-700 dark:text-indigo-300'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
        }`}
      >
        {activeTab === 'settings' && (
          <motion.div
            layoutId="header-active-tab"
            className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 rounded-lg"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <Settings className={`h-4 w-4 ${activeTab === 'settings' ? 'stroke-[2.5]' : ''}`} />
          Settings
        </span>
      </button>
    </nav>
  );
};
