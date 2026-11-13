import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardTab } from '../../types';
import { ChevronDown, LayoutGrid, Check } from 'lucide-react';
import { NAV_GROUP_ORDER, NAV_ITEMS } from '../../config/navigation';

interface DesktopHeaderNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

const TOP_BAR_PRIMARY_IDS: DashboardTab[] = [
  'overview',
  'accounts',
  'transactions',
  'budgets',
  'chat',
];

const COMPACT_MD_IDS = new Set<DashboardTab>(['overview', 'accounts', 'transactions']);

const primaryTopTabs = TOP_BAR_PRIMARY_IDS.map(
  (id) => NAV_ITEMS.find((item) => item.id === id)!
).filter(Boolean);

export const DesktopHeaderNav: React.FC<DesktopHeaderNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const exploreMenuRef = useRef<HTMLDivElement>(null);

  const activePrimaryLg = primaryTopTabs.some((t) => t.id === activeTab);
  const activeTabMeta = NAV_ITEMS.find((t) => t.id === activeTab);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
        setIsExploreOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExploreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <nav
      aria-label="Desktop Top Navigation"
      className="hidden md:flex items-center gap-1 min-w-0"
    >
      {primaryTopTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const showOnMd = COMPACT_MD_IDS.has(tab.id);

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            title={tab.description}
            onClick={() => {
              setIsExploreOpen(false);
              onSelectTab(tab.id);
            }}
            className={`relative items-center gap-1.5 px-2.5 py-1.5 text-xs lg:text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              showOnMd ? 'flex' : 'hidden lg:flex'
            } ${
              isActive
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/70'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="header-active-tab"
                className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'stroke-[2.3]' : ''}`} />
              <span>{tab.shortLabel}</span>
            </span>
          </button>
        );
      })}

      {/* Grouped Mega-Popover for all 17 Pages */}
      <div className="relative" ref={exploreMenuRef}>
        <button
          type="button"
          aria-expanded={isExploreOpen}
          onClick={() => setIsExploreOpen((prev) => !prev)}
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs lg:text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            !activePrimaryLg || isExploreOpen
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/70'
          }`}
        >
          {!activePrimaryLg && !isExploreOpen && (
            <motion.div
              layoutId="header-active-tab"
              className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 rounded-lg"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
            {!activePrimaryLg && activeTabMeta ? (
              <>
                <activeTabMeta.icon className="h-4 w-4 shrink-0 stroke-[2.3]" />
                <span>{activeTabMeta.shortLabel}</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span>All Pages</span>
              </>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                isExploreOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        <AnimatePresence>
          {isExploreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[620px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50"
            >
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  TrueSpend Workspace ({NAV_ITEMS.length} Modules)
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                  Press ⌘K to search anything
                </span>
              </div>

              <div className="p-3 grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto ts-scrollbar">
                {NAV_GROUP_ORDER.map((group) => {
                  const groupItems = NAV_ITEMS.filter((t) => t.group === group.id);
                  if (groupItems.length === 0) return null;

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-950/30 p-2 space-y-1"
                    >
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {group.label}
                      </div>
                      {groupItems.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              onSelectTab(tab.id);
                              setIsExploreOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Icon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-indigo-600 dark:text-indigo-400 stroke-[2.3]' : ''
                                }`}
                              />
                              <span className="truncate">{tab.label}</span>
                            </span>
                            {isActive && <Check className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};
