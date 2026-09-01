import React from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Store, AlertTriangle, Repeat, Wallet } from 'lucide-react';
import { SpendingPattern, MerchantStat, Anomaly, Subscription } from '../../types';

interface InsightsTabProps {
  insights: {
    patterns: SpendingPattern[];
    merchants: MerchantStat[];
    anomalies: Anomaly[];
    subscriptions: Subscription[];
    budgetRecommendations: { category: string; suggestedAmount: number; avgMonthly: number; periods: number }[];
  } | null;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({ insights }) => {
  if (!insights) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
        Analyzing your spending...
      </div>
    );
  }

  const formatMAD = (v: number) => new Intl.NumberFormat('en-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          Personal Intelligence
        </h2>
        <p className="text-gray-500 dark:text-gray-400">AI-driven insights into your financial habits</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Spending Patterns */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Spending Trends
          </h3>
          {insights.patterns.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough historical data to detect trends.</p>
          ) : (
            <div className="space-y-4">
              {insights.patterns.slice(0, 5).map(p => (
                <div key={p.category} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{p.category}</p>
                    <p className="text-xs text-gray-500">Avg: {formatMAD(p.threeMonthAvg)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">{formatMAD(p.currentMonthTotal)}</p>
                    <p className={`text-xs flex items-center justify-end gap-1 ${p.trend === 'up' ? 'text-red-500' : p.trend === 'down' ? 'text-green-500' : 'text-gray-500'}`}>
                      {p.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : p.trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                      {p.changePercent > 0 ? '+' : ''}{p.changePercent}% vs avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anomalies */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Unusual Activity
          </h3>
          {insights.anomalies.length === 0 ? (
            <p className="text-sm text-gray-500">No unusual spending detected recently.</p>
          ) : (
            <div className="space-y-4">
              {insights.anomalies.slice(0, 5).map(a => (
                <div key={a.transactionId} className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/10 rounded-r-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatMAD(a.amount)} in {a.category}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(a.date).toLocaleDateString()} • {a.notes}</p>
                    </div>
                    {a.confidence !== undefined && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300">
                        {a.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mt-2">{a.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Merchant Intelligence */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Store className="h-5 w-5 text-blue-500" />
            Top Merchants
          </h3>
          {insights.merchants.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough data to rank merchants.</p>
          ) : (
            <div className="space-y-3">
              {insights.merchants.slice(0, 5).map((m, idx) => (
                <div key={m.name} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">{idx + 1}</div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.count} visits • {formatMAD(m.avgAmount)} avg</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white">{formatMAD(m.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscriptions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Repeat className="h-5 w-5 text-purple-500" />
            Detected Subscriptions
          </h3>
          {insights.subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500">No recurring subscriptions detected yet.</p>
          ) : (
            <div className="space-y-3">
              {insights.subscriptions.slice(0, 5).map(s => (
                <div key={s.name} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.occurrences} payments • {s.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white flex items-center justify-end gap-2">
                      {formatMAD(s.amount)}/{s.frequency === 'monthly' ? 'mo' : 'wk'}
                    </p>
                    <p className="text-xs flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">{formatMAD(s.annualCost)}/yr</span>
                      {s.confidence !== undefined && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">{s.confidence}% sure</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
