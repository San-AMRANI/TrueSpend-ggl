import React from 'react';
import { DashboardTab } from '../../types';
import { LayoutDashboard, ArrowRightLeft, Users, BarChart2, FileText, Settings } from 'lucide-react';

interface DashboardNavProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

export const DashboardNav: React.FC<DashboardNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: DashboardTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'debts', label: 'Debts & Splits', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'digest', label: 'Digest', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-xs rounded-lg p-1">
      <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

