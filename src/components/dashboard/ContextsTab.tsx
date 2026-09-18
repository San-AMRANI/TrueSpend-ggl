import React, { useState, useMemo } from 'react';
import { FinancialContext, Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import {
  Map,
  Briefcase,
  Wrench,
  Heart,
  Layers,
  Plus,
  Pencil,
  Trash,
  X,
  Calendar as CalendarIcon,
  Tag,
  Sparkles,
  Link2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ContextDetail } from './ContextDetail';

interface ContextsTabProps {
  contexts: FinancialContext[];
  transactions: Transaction[];
  handleCreateContext: (data: any) => Promise<void>;
  handleUpdateContext: (id: string, data: any) => Promise<void>;
  handleDeleteContext: (id: string) => Promise<void>;
  handleLinkTransactions?: (transactionIds: string[], contextId: string) => Promise<any>;
}

interface SuggestedLink {
  transaction: Transaction;
  suggestedContext: FinancialContext;
  allMatchingContexts: FinancialContext[];
}

const contextTypeIcons: Record<string, React.ReactNode> = {
  'Trip': <Map className="w-5 h-5" />,
  'Work / Mission': <Briefcase className="w-5 h-5" />,
  'Project': <Wrench className="w-5 h-5" />,
  'Life Event': <Heart className="w-5 h-5" />,
  'Other': <Layers className="w-5 h-5" />
};

export const ContextsTab: React.FC<ContextsTabProps> = ({
  contexts,
  transactions,
  handleCreateContext,
  handleUpdateContext,
  handleDeleteContext,
  handleLinkTransactions
}) => {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<FinancialContext | null>(null);
  const [formData, setFormData] = useState<Partial<FinancialContext>>({
    name: '',
    type: 'Trip',
    status: 'Planned',
    budget: '',
    startDate: '',
    endDate: '',
    notes: ''
  });

  // State for suggestions linking
  const [selectedContextForTx, setSelectedContextForTx] = useState<Record<string, string>>({});
  const [dismissedTxIds, setDismissedTxIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('truespend_dismissed_context_links');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkingAll, setLinkingAll] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Compute unlinked transactions that match context dates
  const suggestedLinks: SuggestedLink[] = useMemo(() => {
    const unlinked = transactions.filter(t => !t.contextId && !dismissedTxIds.has(t.id));
    if (unlinked.length === 0 || contexts.length === 0) return [];

    const suggestions: SuggestedLink[] = [];

    for (const tx of unlinked) {
      const txDateStr = format(new Date(tx.createdAt), 'yyyy-MM-dd');
      const matching: FinancialContext[] = [];

      for (const ctx of contexts) {
        if (!ctx.startDate && !ctx.endDate) continue;
        const startStr = ctx.startDate ? format(new Date(ctx.startDate), 'yyyy-MM-dd') : null;
        const endStr = ctx.endDate ? format(new Date(ctx.endDate), 'yyyy-MM-dd') : null;

        let matches = false;
        if (startStr && endStr) {
          matches = txDateStr >= startStr && txDateStr <= endStr;
        } else if (startStr) {
          matches = txDateStr === startStr;
        } else if (endStr) {
          matches = txDateStr === endStr;
        }

        if (matches) {
          matching.push(ctx);
        }
      }

      if (matching.length > 0) {
        // Prioritize Active first, then Planned, then Completed
        matching.sort((a, b) => {
          const rank = { Active: 1, Planned: 2, Completed: 3 };
          return (rank[a.status] || 4) - (rank[b.status] || 4);
        });

        suggestions.push({
          transaction: tx,
          suggestedContext: matching[0],
          allMatchingContexts: matching
        });
      }
    }

    return suggestions.sort((a, b) => new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime());
  }, [transactions, contexts, dismissedTxIds]);

  const handleDismiss = (txId: string) => {
    setDismissedTxIds(prev => {
      const updated = new Set(prev).add(txId);
      try {
        localStorage.setItem('truespend_dismissed_context_links', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const handleLinkSingle = async (txId: string, contextId: string, txDesc: string, ctxName: string) => {
    if (!handleLinkTransactions) return;
    setLinkingId(txId);
    try {
      await handleLinkTransactions([txId], contextId);
      setFeedbackMessage(`Linked "${txDesc}" to ${ctxName}`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (e) {
      console.error('Failed to link transaction', e);
    } finally {
      setLinkingId(null);
    }
  };

  const handleLinkAll = async () => {
    if (!handleLinkTransactions || suggestedLinks.length === 0) return;
    setLinkingAll(true);
    try {
      const groups: Record<string, string[]> = {};
      for (const item of suggestedLinks) {
        const targetCtxId = selectedContextForTx[item.transaction.id] || item.suggestedContext.id;
        if (!groups[targetCtxId]) groups[targetCtxId] = [];
        groups[targetCtxId].push(item.transaction.id);
      }
      for (const [ctxId, txIds] of Object.entries(groups)) {
        await handleLinkTransactions(txIds, ctxId);
      }
      setFeedbackMessage(`Successfully linked ${suggestedLinks.length} transaction${suggestedLinks.length > 1 ? 's' : ''} to matching contexts!`);
      setTimeout(() => setFeedbackMessage(null), 4500);
    } catch (e) {
      console.error('Failed to link all transactions', e);
    } finally {
      setLinkingAll(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingContext(null);
    setFormData({ name: '', type: 'Trip', status: 'Planned', budget: '', startDate: '', endDate: '', notes: '' });
    setIsModalOpen(true);
  };
  
  const handleOpenEdit = (e: React.MouseEvent, ctx: FinancialContext) => {
    e.stopPropagation();
    setEditingContext(ctx);
    setFormData({
      name: ctx.name,
      type: ctx.type,
      status: ctx.status,
      budget: ctx.budget || '',
      startDate: ctx.startDate ? format(new Date(ctx.startDate), 'yyyy-MM-dd') : '',
      endDate: ctx.endDate ? format(new Date(ctx.endDate), 'yyyy-MM-dd') : '',
      notes: ctx.notes || ''
    });
    setIsModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      budget: formData.budget || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    };
    if (editingContext) {
      await handleUpdateContext(editingContext.id, payload);
    } else {
      await handleCreateContext(payload);
    }
    setIsModalOpen(false);
  };
  
  if (selectedContextId) {
    const ctx = contexts.find(c => c.id === selectedContextId);
    if (!ctx) {
      setSelectedContextId(null);
      return null;
    }
    return (
      <ContextDetail 
        context={ctx} 
        transactions={transactions.filter(t => t.contextId === ctx.id)}
        allTransactions={transactions}
        onBack={() => setSelectedContextId(null)} 
        onEdit={(e) => handleOpenEdit(e, ctx)}
        onDelete={async () => {
          if(confirm('Are you sure you want to delete this context? Transactions will not be deleted but they will lose this context.')) {
            await handleDeleteContext(ctx.id);
            setSelectedContextId(null);
          }
        }}
        onLinkTransactions={handleLinkTransactions}
      />
    );
  }
  
  const planned = contexts.filter(c => c.status === 'Planned');
  const active = contexts.filter(c => c.status === 'Active');
  const completed = contexts.filter(c => c.status === 'Completed');

  const ContextCard = ({ ctx }: { ctx: FinancialContext }) => {
    const ctxTransactions = transactions.filter(t => t.contextId === ctx.id);
    const spent = ctxTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const refunds = ctxTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const netSpent = spent - refunds;

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedContextId(ctx.id)}>
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl ${
                ctx.type === 'Trip' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                ctx.type === 'Work / Mission' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                ctx.type === 'Project' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {contextTypeIcons[ctx.type] || <Tag className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{ctx.name}</h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 space-x-2">
                  <span className="flex items-center">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                    {ctx.startDate ? format(new Date(ctx.startDate), 'MMM d, yyyy') : 'No start date'}
                    {ctx.endDate ? ` → ${format(new Date(ctx.endDate), 'MMM d, yyyy')}` : ''}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => handleOpenEdit(e, ctx)}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-end">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Spent</p>
              <p className="text-xl font-bold">{netSpent.toLocaleString()} MAD</p>
            </div>
            {ctx.budget && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget</p>
                <p className="text-sm font-semibold">{parseFloat(ctx.budget).toLocaleString()} MAD</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Financial Contexts</h2>
          <p className="text-gray-500 dark:text-gray-400">Track spending for specific trips, projects, and events.</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Context
        </Button>
      </div>

      {feedbackMessage && (
        <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {suggestedLinks.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-blue-100/80 dark:border-blue-900/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg text-blue-950 dark:text-blue-100 font-bold">
                      Suggested Context Links
                    </CardTitle>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                      {suggestedLinks.length} unlinked {suggestedLinks.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-blue-700/90 dark:text-blue-300 mt-0.5">
                    The app detected earlier transactions matching the dates of your contexts. Link them with one click without having to edit old transactions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
                  disabled={linkingAll || Boolean(linkingId)}
                  onClick={handleLinkAll}
                >
                  <Link2 className="w-4 h-4 mr-1.5" />
                  {linkingAll ? 'Linking All...' : `Link All (${suggestedLinks.length})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 space-y-2">
            {suggestedLinks.map(({ transaction: tx, suggestedContext, allMatchingContexts }) => {
              const activeTargetId = selectedContextForTx[tx.id] || suggestedContext.id;
              const activeTargetCtx = contexts.find(c => c.id === activeTargetId) || suggestedContext;
              const isThisLinking = linkingId === tx.id || linkingAll;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/40 shadow-xs hover:shadow-sm transition-all gap-3"
                >
                  <div className="flex items-start sm:items-center space-x-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      tx.type === 'Expense' 
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' 
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {tx.notes || tx.category || tx.type}
                        </span>
                        {tx.notes && tx.category && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {tx.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span className={`font-semibold ${
                          tx.type === 'Expense' ? 'text-gray-900 dark:text-gray-100' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {tx.type === 'Expense' ? '-' : '+'}{parseFloat(tx.amount).toFixed(2)} MAD
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Context:</span>
                      {allMatchingContexts.length === 1 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                          {activeTargetCtx.name}
                        </span>
                      ) : (
                        <select
                          value={activeTargetId}
                          onChange={(e) => setSelectedContextForTx({ ...selectedContextForTx, [tx.id]: e.target.value })}
                          className="text-xs h-8 py-1 px-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {allMatchingContexts.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.status})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isThisLinking}
                        onClick={() => handleLinkSingle(tx.id, activeTargetCtx.id, tx.notes || tx.category || tx.type, activeTargetCtx.name)}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" />
                        {linkingId === tx.id ? 'Linking...' : `Link to ${activeTargetCtx.name}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isThisLinking}
                        onClick={() => handleDismiss(tx.id)}
                        className="text-xs h-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Dismiss suggestion for this transaction"
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      
      {active.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 text-green-600 dark:text-green-400">Active</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(c => <ContextCard key={c.id} ctx={c} />)}
          </div>
        </section>
      )}

      {planned.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 text-blue-600 dark:text-blue-400">Planned</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planned.map(c => <ContextCard key={c.id} ctx={c} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 text-gray-500 dark:text-gray-400">Completed</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map(c => <ContextCard key={c.id} ctx={c} />)}
          </div>
        </section>
      )}

      {contexts.length === 0 && (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <Map className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Contexts Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
              Create a financial context to track expenses for an upcoming trip, home renovation, or a business mission.
            </p>
            <Button onClick={handleOpenCreate}>
              Create your first Context
            </Button>
          </CardContent>
        </Card>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-semibold">{editingContext ? 'Edit Context' : 'Create Context'}</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Marrakech Trip" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                    <option value="Trip">Trip</option>
                    <option value="Work / Mission">Work / Mission</option>
                    <option value="Project">Project</option>
                    <option value="Life Event">Life Event</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                    <option value="Planned">Planned</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date (Optional)</label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date (Optional)</label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Budget (Optional)</label>
                <Input type="number" step="0.01" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any extra details..." />
              </div>
              <div className="pt-4 flex justify-end space-x-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingContext ? 'Save Changes' : 'Create Context'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
