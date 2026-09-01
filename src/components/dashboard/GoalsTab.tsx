import React, { useState } from 'react';
import { Target, Plus, CheckCircle2, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import { Goal } from '../../types';

interface GoalsTabProps {
  goals: Goal[];
  onCreateGoal: (payload: any) => Promise<void>;
  onUpdateGoal: (id: string, payload: any) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onContribute: (id: string, amount: number) => Promise<void>;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({ goals, onCreateGoal, onUpdateGoal, onDeleteGoal, onContribute }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', deadline: '', category: '', notes: '' });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) return;
    await onCreateGoal({
      name: newGoal.name,
      targetAmount: parseFloat(newGoal.targetAmount),
      deadline: newGoal.deadline || null,
      category: newGoal.category,
      notes: newGoal.notes
    });
    setNewGoal({ name: '', targetAmount: '', deadline: '', category: '', notes: '' });
    setShowAdd(false);
  };

  const handleContribute = async (id: string) => {
    const amountStr = prompt('Enter amount to contribute:');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Invalid amount');
      return;
    }
    await onContribute(id, amount);
  };

  const formatMAD = (v: number) => new Intl.NumberFormat('en-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-500" />
            Financial Goals
          </h2>
          <p className="text-gray-500 dark:text-gray-400">Track and manage your savings targets</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddSubmit} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create New Goal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Name *</label>
              <input required type="text" value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="e.g. New Car, Vacation" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Amount (MAD) *</label>
              <input required type="number" min="1" step="0.01" value={newGoal.targetAmount} onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date (Optional)</label>
              <input type="date" value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category (Optional)</label>
              <input type="text" value={newGoal.category} onChange={e => setNewGoal({...newGoal, category: e.target.value})} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="e.g. Savings, Transport" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">Save Goal</button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Target className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No goals set</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">Set financial goals like saving for a trip, a new gadget, or building your emergency fund.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const isCompleted = goal.currentAmount >= goal.targetAmount;
            
            return (
              <div key={goal.id} className={`bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm transition-all ${isCompleted ? 'border-green-200 dark:border-green-900/50 ring-1 ring-green-100 dark:ring-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                      {goal.name}
                      {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    </h3>
                    {goal.category && <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">{goal.category}</span>}
                  </div>
                  <button onClick={() => onDeleteGoal(goal.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                
                <div className="mt-4 mb-2 flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMAD(goal.currentAmount)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">of {formatMAD(goal.targetAmount)} target</p>
                  </div>
                  {!isCompleted && (
                    <button onClick={() => handleContribute(goal.id)} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-md transition-colors">
                      <TrendingUp className="h-4 w-4" />
                      Add Funds
                    </button>
                  )}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-3 overflow-hidden">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${isCompleted ? 'bg-green-500' : 'bg-indigo-600 dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
                </div>
                
                {!isCompleted && goal.deadline && (() => {
                  const daysRemaining = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / 86_400_000));
                  const monthsRemaining = Math.max(1, daysRemaining / 30.44);
                  const remainingAmount = goal.targetAmount - goal.currentAmount;
                  const reqPerMonth = remainingAmount / monthsRemaining;
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Target: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                      <p className="text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                        Requires {formatMAD(reqPerMonth)} / month
                      </p>
                    </div>
                  );
                })()}
                
                {isCompleted && goal.deadline && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed ahead of {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                )}
                
                {!isCompleted && !goal.deadline && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No target date set
                  </p>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
