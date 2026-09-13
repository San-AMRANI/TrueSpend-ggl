import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { KPI, Transaction } from '../../types';
import { generateHistoricalCashFlow } from '../../lib/cashFlowEngine';
import { format, parseISO } from 'date-fns';
import { TrendingDown, TrendingUp, Activity, ArrowRightLeft, ChevronDown, ChevronRight } from 'lucide-react';

interface CashFlowTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({ kpis, transactions }) => {
  const [daysToShow, setDaysToShow] = useState(30);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (dateStr: string) => {
    setCollapsedDays(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const days = useMemo(() => {
    if (!kpis) return [];
    return generateHistoricalCashFlow(transactions, kpis.totalLiquidity);
  }, [kpis, transactions]);

  if (!kpis) return <div className="p-8 text-center text-gray-500">Loading Cash Flow Data...</div>;

  const displayDays = days.slice(0, daysToShow);

  // Calculate totals for the displayed period
  let periodInflow = 0;
  let periodOutflow = 0;
  displayDays.forEach(day => {
    day.transactions.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'Income') periodInflow += amt;
      else if (t.type === 'Expense' || t.type === 'Debt Repayment') periodOutflow += amt;
    });
  });

  const getTransactionIcon = (type: string) => {
    if (type === 'Income') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (type === 'Transfer') return <ArrowRightLeft className="h-4 w-4 text-gray-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Historical Cash Flow
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track how your balance has changed over time based on actual transactions.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpis.totalLiquidity.toLocaleString()} <span className="text-sm font-normal text-gray-500">MAD</span></p>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Period Inflow</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">+{periodInflow.toLocaleString()} <span className="text-sm font-normal text-gray-500">MAD</span></p>
          </CardContent>
        </Card>

        <Card className="bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Period Outflow</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">-{periodOutflow.toLocaleString()} <span className="text-sm font-normal text-gray-500">MAD</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">Cash Flow Timeline</h3>

        <div className="space-y-6">
          {displayDays.map((day, idx) => {
            const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
            const isCollapsed = collapsedDays[day.date];
            
            let daySpent = 0;
            let dayIncome = 0;
            day.transactions.forEach(t => {
              const amt = parseFloat(t.amount);
              if (t.type === 'Expense' || t.type === 'Debt Repayment') daySpent += amt;
              else if (t.type === 'Income') dayIncome += amt;
            });

            return (
              <div key={day.date} className="relative pl-6 sm:pl-8 border-l-2 border-gray-100 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                <div className={`absolute -left-[9px] top-3 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900 ${isToday ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                
                <button
                  type="button"
                  onClick={() => toggleDay(day.date)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 -ml-2 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {isToday ? 'TODAY' : format(parseISO(day.date), 'MMM d, yyyy')}
                    </h4>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-6 sm:pl-0">
                    {daySpent > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                        Spent: -{daySpent.toLocaleString()} MAD
                      </span>
                    )}
                    {dayIncome > 0 && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                        In: +{dayIncome.toLocaleString()} MAD
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-sm ml-auto sm:ml-0">
                      <span className="text-gray-500 dark:text-gray-400 text-xs hidden sm:inline">Closing Balance:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{day.closingBalance.toLocaleString()} MAD</span>
                    </div>
                  </div>
                </button>

                {!isCollapsed && (
                  <>
                    {day.transactions.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {day.transactions.map(t => (
                          <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg text-sm bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800/60">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-md ${t.type === 'Income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : t.type === 'Transfer' ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {getTransactionIcon(t.type)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                  {t.category || t.type}
                                </p>
                                {t.notes && <p className="text-xs text-gray-500">{t.notes}</p>}
                              </div>
                            </div>
                            <span className={`font-semibold ${t.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : t.type === 'Transfer' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                              {t.type === 'Income' ? '+' : t.type === 'Transfer' ? '' : '-'}{parseFloat(t.amount).toLocaleString()} MAD
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2 pl-2 text-xs text-gray-500 dark:text-gray-400 italic">No transactions on this day.</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {days.length > daysToShow && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => setDaysToShow(prev => prev + 30)}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full transition-colors"
            >
              Load More History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
