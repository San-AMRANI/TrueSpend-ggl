import React, { useEffect, useRef, useState } from 'react';
import { DashboardTab } from '../../types';
import { ChevronDown, ChevronUp, LayoutGrid, X } from 'lucide-react';
import { NAV_GROUP_ORDER, NAV_ITEMS } from '../../config/navigation';

interface DashboardNavProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const quickTabs = NAV_ITEMS.filter((item) => item.quickMobile);
const quickTabIds: DashboardTab[] = quickTabs.map((item) => item.id);

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

  const renderTab = (tab: (typeof NAV_ITEMS)[number], compact = false) => {
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
    ? NAV_ITEMS.find((t) => t.id === activeTab)
    : undefined;

  return (
    <>
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
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse navigation menu' : `Expand all ${NAV_ITEMS.length} navigation pages`}
            onClick={() => (isExpanded ? close() : open())}
            className="flex h-5 w-full items-center justify-center gap-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <span className="h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-700" />
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>

          {isExpanded ? (
            <div className="max-h-[72vh] overflow-y-auto overscroll-contain pb-2 pt-1 space-y-3 animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between px-1.5 pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  All Pages ({NAV_ITEMS.length})
                </span>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              </div>
              {NAV_GROUP_ORDER.map((group) => {
                const groupTabs = NAV_ITEMS.filter((item) => item.group === group.id);
                if (groupTabs.length === 0) return null;
                return (
                  <div key={group.id} className="space-y-1">
                    <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {groupTabs.map((tab) => renderTab(tab, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {quickTabs.map((tab) => renderTab(tab, true))}

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
