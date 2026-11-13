import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DashboardTab } from '../../types';
import { ChevronDown, MoreHorizontal, Settings } from 'lucide-react';
import { NAV_GROUP_ORDER, NAV_ITEMS } from '../../config/navigation';

interface DesktopHeaderNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

const mainTabs = NAV_ITEMS.filter((item) => item.placement === 'primary');
const moreTabs = NAV_ITEMS.filter((item) => item.placement === 'more');

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
    <nav aria-label="Desktop Navigation" className="hidden md:flex items-center gap-0.5 lg:gap-1">
      {mainTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-2 py-1.5 lg:px-2.5 text-xs lg:text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span>{tab.shortLabel}</span>
            </span>
          </button>
        );
      })}

      {/* More Dropdown grouped by domain */}
      <div className="relative" ref={moreMenuRef}>
        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          className={`relative flex items-center gap-1.5 px-2 py-1.5 lg:px-2.5 text-xs lg:text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
          <span className="relative z-10 flex items-center gap-1 whitespace-nowrap">
            {activeMoreTab ? (
              <>
                <activeMoreTab.icon className="h-4 w-4 shrink-0 stroke-[2.5]" />
                <span>{activeMoreTab.shortLabel}</span>
              </>
            ) : (
              <>
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                <span>More</span>
              </>
            )}
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {isMoreOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {NAV_GROUP_ORDER.map((group) => {
              const itemsInGroup = moreTabs.filter((t) => t.group === group.id);
              if (itemsInGroup.length === 0) return null;
              return (
                <div key={group.id} className="py-1 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                  <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {group.label}
                  </div>
                  {itemsInGroup.map((tab) => {
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
                        className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 text-xs lg:text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
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
        className={`relative flex items-center gap-1.5 px-2 py-1.5 lg:px-2.5 text-xs lg:text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
        <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
          <Settings className={`h-4 w-4 shrink-0 ${activeTab === 'settings' ? 'stroke-[2.5]' : ''}`} />
          <span>Settings</span>
        </span>
      </button>
    </nav>
  );
};
