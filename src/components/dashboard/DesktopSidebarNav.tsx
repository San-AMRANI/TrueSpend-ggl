import React from 'react';
import { motion } from 'motion/react';
import { DashboardTab } from '../../types';
import { NAV_GROUP_ORDER, NAV_ITEMS } from '../../config/navigation';
import { useTheme } from '../../context/ThemeContext';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  CloudOff,
} from 'lucide-react';

interface DesktopSidebarNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  appIconSrc: string;
  outboxCount?: number;
}

export const DesktopSidebarNav: React.FC<DesktopSidebarNavProps> = ({
  activeTab,
  onSelectTab,
  appIconSrc,
  outboxCount = 0,
}) => {
  const { sidebarCollapsed, toggleSidebarCollapsed, setDesktopNavLayout } = useTheme();

  return (
    <aside
      aria-label="Desktop Side Navigation"
      className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen border-r border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-30 transition-[width] duration-200 ease-out select-none ${
        sidebarCollapsed ? 'w-[74px]' : 'w-64'
      }`}
    >
      {/* Top Brand Header */}
      <div
        className={`flex items-center border-b border-gray-200 dark:border-gray-800 h-14 px-3 shrink-0 ${
          sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
        }`}
      >
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg px-1 py-0.5"
          >
            <img src={appIconSrc} alt="TrueSpend Logo" className="h-7 w-7 shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
              TrueSpend
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Expand Side Menu' : 'Collapse Side Menu'}
          aria-label={sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Scrollable Navigation Groups */}
      <div className="flex-1 overflow-y-auto ts-scrollbar py-3 px-2.5 space-y-4">
        {NAV_GROUP_ORDER.map((group) => {
          const groupTabs = NAV_ITEMS.filter((item) => item.group === group.id);
          if (groupTabs.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1">
              {!sidebarCollapsed ? (
                <div className="px-2.5 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                  {group.label}
                </div>
              ) : (
                <div className="mx-3 my-1.5 border-t border-gray-100 dark:border-gray-800" />
              )}

              <div className="space-y-0.5">
                {groupTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const showOutbox = tab.id === 'settings' && outboxCount > 0;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      title={sidebarCollapsed ? `${tab.label} — ${tab.description}` : tab.description}
                      onClick={() => onSelectTab(tab.id)}
                      className={`relative w-full flex items-center rounded-xl transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-2.5 py-2'
                      } ${
                        isActive
                          ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 font-medium'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-tab"
                          className="absolute inset-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30"
                          transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-2.5 min-w-0 w-full justify-center md:justify-start">
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 ${
                            isActive ? 'text-indigo-600 dark:text-indigo-400 stroke-[2.3]' : ''
                          } ${sidebarCollapsed ? 'mx-auto' : ''}`}
                        />
                        {!sidebarCollapsed && (
                          <span className="text-[13px] truncate">{tab.label}</span>
                        )}
                        {showOutbox && (
                          <span
                            className={`${
                              sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                            } inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-amber-600 text-white`}
                          >
                            {!sidebarCollapsed && <CloudOff className="h-2.5 w-2.5" />}
                            {outboxCount}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Layout Switcher Footer */}
      <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 shrink-0">
        <button
          type="button"
          onClick={() => setDesktopNavLayout('top')}
          title="Switch to Top Header Navigation Bar"
          className={`w-full flex items-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer whitespace-nowrap ${
            sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2 gap-2'
          }`}
        >
          <span className="flex items-center gap-2">
            <PanelTop className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            {!sidebarCollapsed && <span>Use Top Menu</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">Top</span>
          )}
        </button>
      </div>
    </aside>
  );
};
