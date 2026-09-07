import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DashboardTab } from '../../types';
import { LayoutDashboard, ArrowRightLeft, Users, BarChart2, FileText, Settings, Calculator, WalletCards, CalendarDays, ChevronDown, ChevronUp, Bot, FileBarChart, MoreHorizontal } from 'lucide-react';

interface DashboardNavProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const tabs: { id: DashboardTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', shortLabel: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart2 },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Transactions', icon: ArrowRightLeft },
  { id: 'debts', label: 'Debts & Splits', shortLabel: 'Debts', icon: Users },
  { id: 'budgets', label: 'Budgets', shortLabel: 'Budgets', icon: WalletCards },
  { id: 'what-if', label: 'What-If', shortLabel: 'What-If', icon: Calculator },
  { id: 'digest', label: 'Digest', shortLabel: 'Digest', icon: FileText },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: FileBarChart },
  { id: 'chat', label: 'AI Chat', shortLabel: 'AI Chat', icon: Bot },
];

const quickTabIds: DashboardTab[] = ['overview', 'analytics', 'transactions', 'chat'];
const mainDesktopTabIds: DashboardTab[] = ['overview', 'calendar', 'analytics', 'transactions', 'budgets'];

export const DashboardNav: React.FC<DashboardNavProps> = ({ activeTab, setActiveTab }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const cancelCollapse = () => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  };
  const close = () => { cancelCollapse(); setIsExpanded(false); };
  const open = () => {
    cancelCollapse();
    setIsExpanded(true);
    collapseTimer.current = window.setTimeout(() => setIsExpanded(false), 5500) as any;
  };
  const chooseTab = (tab: DashboardTab) => { setActiveTab(tab); close(); };

  useEffect(() => () => cancelCollapse(), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartY.current === null) return;
    const movement = touchStartY.current - event.changedTouches[0].clientY;
    touchStartY.current = null;
    if (movement > 32) open();
    if (movement < -32) close();
  };

  const renderTab = (tab: typeof tabs[number], compact = false) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return <button key={tab.id} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => chooseTab(tab.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium leading-none transition-colors ${isActive ? 'bg-gray-100 dark:bg-gray-800 text-gray-950' : 'text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:bg-gray-800'}`}><Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} /><span className="max-w-full truncate">{compact ? tab.shortLabel : tab.label}</span></button>;
  };

  const mainTabsList = tabs.filter(t => mainDesktopTabIds.includes(t.id));
  const moreTabsList = tabs.filter(t => !mainDesktopTabIds.includes(t.id));
  const isMoreActive = moreTabsList.some(t => t.id === activeTab);

  return <>
    <nav aria-label="Dashboard sections" className="hidden md:flex justify-center relative z-30 mb-8 px-4">
      <div className="flex items-center gap-1 p-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {mainTabsList.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="desktop-active-tab"
                  className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
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
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isMoreActive || isMoreOpen
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
            }`}
          >
            {isMoreActive && !isMoreOpen && (
              <motion.div
                layoutId="desktop-active-tab"
                className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <MoreHorizontal className={`h-4 w-4 ${isMoreActive ? 'stroke-[2.5]' : ''}`} />
              More
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {isMoreOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {moreTabsList.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setIsMoreOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : ''}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>


    <nav aria-label="Dashboard sections" onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; if (isExpanded) cancelCollapse(); }} onTouchEnd={handleTouchEnd} className={`fixed inset-x-0 bottom-0 z-50 m-0 mb-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/95 px-2 pb-0 pt-1 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden transition-transform duration-200 ${activeTab === 'chat' ? 'translate-y-full pointer-events-none' : 'translate-y-0'}`}>
      <div className="mx-auto max-w-lg">
        <button type="button" aria-expanded={isExpanded} aria-label={isExpanded ? 'Collapse all navigation pages' : 'Expand all navigation pages'} onClick={() => isExpanded ? close() : open()} className="flex h-5 w-full items-center justify-center text-gray-400"><span className="mr-1 h-1 w-9 rounded-full bg-gray-300" />{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}</button>
        <div className={`grid grid-cols-4 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isExpanded ? 'max-h-52 opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}>{tabs.map((tab) => renderTab(tab, true))}</div>
        <div className={`grid grid-cols-4 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isExpanded ? 'pointer-events-none max-h-0 opacity-0' : 'max-h-16 opacity-100'}`}>{tabs.filter((tab) => quickTabIds.includes(tab.id)).map((tab) => renderTab(tab, true))}</div>
      </div>
    </nav>
  </>;
};
