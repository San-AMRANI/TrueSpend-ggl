import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CycleAutomationSettingsCard } from '../CycleAutomationSettingsCard';
import { dashboardService } from '../../../services/api/dashboardService';
import { parseFinancialRuleDetails } from '../../../lib/auditContracts';
import type {
  DashboardTab,
  ExperienceTier,
  FinancialRuleItem,
  FinancialRuleLogItem,
  Goal,
  Wallet,
} from '../../../types';

export interface SettingsAutomationSectionProps {
  isAdvanced: boolean;
  switchingTier: boolean;
  onSwitchTier: (tier: ExperienceTier) => void;
  token: string | null;
  wallets: Wallet[];
  goals: Goal[];
  setActiveTab?: (tab: DashboardTab) => void;
  rules: FinancialRuleItem[];
  setRules: React.Dispatch<React.SetStateAction<FinancialRuleItem[]>>;
  ruleLogs: FinancialRuleLogItem[];
  showToast: (msg: string) => void;
}

export const SettingsAutomationSection: React.FC<SettingsAutomationSectionProps> = ({
  isAdvanced,
  switchingTier,
  onSwitchTier,
  token,
  wallets,
  goals,
  setActiveTab,
  rules,
  setRules,
  ruleLogs,
  showToast,
}) => {
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('transaction_posted');
  const [ruleCondField, setRuleCondField] = useState<
    'minAmount' | 'counterparty' | 'category' | 'thresholdMad' | 'pacePercent' | 'withinDays'
  >('minAmount');
  const [ruleCondVal, setRuleCondVal] = useState('');
  const [ruleActionType, setRuleActionType] = useState('send_notification');
  const [ruleDryRunResult, setRuleDryRunResult] = useState<{
    matched: boolean;
    matchedConditions: string[];
    failedConditions: string[];
    proposedResultSummary: string;
    requiresApproval: boolean;
  } | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const handleDryRun = async () => {
    if (!ruleCondVal.trim()) return;
    const conds: Record<string, unknown> = { cooldownHours: 24 };
    conds[ruleCondField] = ['minAmount', 'thresholdMad', 'pacePercent', 'withinDays'].includes(
      ruleCondField
    )
      ? Number(ruleCondVal)
      : ruleCondVal.trim();
    const res = await dashboardService.dryRunFinancialRule(
      {
        name: ruleName.trim() || 'Preview Rule',
        triggerType: ruleTrigger,
        conditions: conds,
        actionType: ruleActionType,
        actionPayload: ruleActionType === 'prepare_allocation' ? { percent: 20 } : {},
        sampleEvent: {
          amount: ['minAmount'].includes(ruleCondField) ? Number(ruleCondVal) : 1200,
          walletBalanceMad: ['thresholdMad'].includes(ruleCondField) ? Number(ruleCondVal) : 5000,
          pacePercent: ['pacePercent'].includes(ruleCondField) ? Number(ruleCondVal) : 95,
          withinDays: ['withinDays'].includes(ruleCondField) ? Number(ruleCondVal) : 2,
          counterparty:
            ruleCondField === 'counterparty' ? ruleCondVal.trim() : 'Sample Merchant',
          category: ruleCondField === 'category' ? ruleCondVal.trim() : 'Dining',
          description: `Dry run test event (${ruleCondVal.trim()})`,
        },
      },
      token
    );
    setRuleDryRunResult(res);
  };

  const handleCreateRule = async () => {
    if (!ruleName.trim() || !ruleCondVal.trim()) return;
    const conds: Record<string, unknown> = { cooldownHours: 24 };
    conds[ruleCondField] = ['minAmount', 'thresholdMad', 'pacePercent', 'withinDays'].includes(
      ruleCondField
    )
      ? Number(ruleCondVal)
      : ruleCondVal.trim();
    const created = await dashboardService.upsertFinancialRule(
      {
        name: ruleName.trim(),
        triggerType: ruleTrigger,
        conditions: conds,
        actionType: ruleActionType,
        actionPayload:
          ruleActionType === 'prepare_allocation'
            ? { percent: 20, target: 'Savings' }
            : { amount: 500 },
        approvalPolicy:
          ruleActionType === 'send_notification' ? 'notify_only' : 'draft_for_approval',
      },
      token
    );
    setRules((prev) => [created, ...prev]);
    setRuleName('');
    setRuleCondVal('');
    setRuleDryRunResult(null);
    showToast('Financial rule saved.');
  };

  return (
    <div className="space-y-6">
      {/* 1. Monthly & Yearly Payday Closeout */}
      <CycleAutomationSettingsCard
        wallets={wallets}
        goals={goals}
        onNavigateTab={setActiveTab}
      />

      {/* 2. Automated Financial Rules */}
      {!isAdvanced ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Automated Financial Rules
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Build custom IF/THEN triggers with dry-run testing in Advanced · Free mode.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={switchingTier}
            onClick={() => onSwitchTier('advanced')}
            className="shrink-0 whitespace-nowrap text-xs"
          >
            Enable Advanced · Free
          </Button>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Automated Financial Rules
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Rules create notifications or Review Inbox drafts with cooldown protection—never silently moving funds.
              </p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {rules.length} rule{rules.length === 1 ? '' : 's'} configured
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Clean 2-Row Rule Builder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="rule-name"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Rule Name
                </label>
                <input
                  id="rule-name"
                  type="text"
                  placeholder="e.g. Flag Large Spend"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="rule-trigger"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  When (Trigger)
                </label>
                <select
                  id="rule-trigger"
                  value={ruleTrigger}
                  onChange={(e) => setRuleTrigger(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="transaction_posted">On Transaction Posted</option>
                  <option value="salary_confirmed">On Salary Confirmed</option>
                  <option value="balance_threshold_crossed">On Balance Threshold</option>
                  <option value="commitment_approaching">On Commitment Approaching</option>
                  <option value="budget_pace_crossed">On Budget Pace Crossed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="rule-cond-field"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Condition
                </label>
                <select
                  id="rule-cond-field"
                  value={ruleCondField}
                  onChange={(e) => setRuleCondField(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="minAmount">Min Amount (MAD)</option>
                  <option value="counterparty">Counterparty Contains</option>
                  <option value="category">Category Contains</option>
                  <option value="thresholdMad">Wallet Balance ≤ (MAD)</option>
                  <option value="pacePercent">Budget Pace ≥ (%)</option>
                  <option value="withinDays">Due Within (Days)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="rule-cond-val"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Value
                </label>
                <input
                  id="rule-cond-val"
                  type="text"
                  placeholder="e.g. 1000 or Uber"
                  value={ruleCondVal}
                  onChange={(e) => setRuleCondVal(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="rule-action"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Then (Action)
                </label>
                <select
                  id="rule-action"
                  value={ruleActionType}
                  onChange={(e) => setRuleActionType(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="send_notification">Send Notification</option>
                  <option value="create_review_draft">Create Review Draft</option>
                  <option value="suggest_category">Suggest Category</option>
                  <option value="prepare_allocation">Prepare Payday Allocation</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDryRun}
                  className="flex-1 h-9 text-xs whitespace-nowrap"
                >
                  Dry-Run
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateRule}
                  className="flex-1 h-9 text-xs whitespace-nowrap"
                >
                  Add Rule
                </Button>
              </div>
            </div>

            {ruleDryRunResult && (
              <div
                className={`rounded-lg border p-3 text-xs space-y-1 ${
                  ruleDryRunResult.matched
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    {ruleDryRunResult.matched
                      ? 'Dry-Run Matched (No Side Effects)'
                      : 'Dry-Run Did Not Match'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRuleDryRunResult(null)}
                    className="text-xs underline text-gray-600 dark:text-gray-300"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {ruleDryRunResult.proposedResultSummary}
                </p>
                {ruleDryRunResult.matchedConditions.length > 0 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Matched: {ruleDryRunResult.matchedConditions.join(', ')}
                  </p>
                )}
                {ruleDryRunResult.failedConditions.length > 0 && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Failed: {ruleDryRunResult.failedConditions.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Existing Rules List */}
            {rules.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                No custom rules yet. Fill in a rule above and test it with Dry-Run before saving.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                {rules.map((r) => {
                  const parsed = parseFinancialRuleDetails(r);
                  return (
                    <div
                      key={r.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {r.name}
                          </span>
                          <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">·</span>
                          <span
                            className={
                              r.enabled
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-gray-500 dark:text-gray-400'
                            }
                          >
                            {r.enabled ? 'Active' : 'Paused'}
                          </span>
                          <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">·</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {r.triggerType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          {parsed.conditionChips.join(' · ')} → {parsed.actionSummary}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await dashboardService.upsertFinancialRule(
                              {
                                id: r.id,
                                name: r.name,
                                enabled: !r.enabled,
                                triggerType: r.triggerType,
                                conditions: parsed.conditions,
                                actionType: r.actionType,
                                actionPayload: parsed.actionPayload,
                                approvalPolicy: r.approvalPolicy,
                              },
                              token
                            );
                            setRules((prev) =>
                              prev.map((item) => (item.id === r.id ? updated : item))
                            );
                          }}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {r.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await dashboardService.deleteFinancialRule(r.id, token);
                            setRules((prev) => prev.filter((item) => item.id !== r.id));
                          }}
                          className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Collapsible Execution Log */}
            {ruleLogs.length > 0 && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setLogsExpanded((prev) => !prev)}
                  aria-expanded={logsExpanded}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {logsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Recent Rule Execution Log ({ruleLogs.length})
                </button>
                {logsExpanded && (
                  <div className="mt-2.5 divide-y divide-gray-100 dark:divide-gray-800 text-xs text-gray-600 dark:text-gray-400">
                    {ruleLogs.slice(0, 8).map((l) => (
                      <div key={l.id} className="py-1.5 flex justify-between gap-2">
                        <span className="truncate">
                          <strong className="text-gray-800 dark:text-gray-200">{l.outcomeStatus}</strong> ·{' '}
                          {l.triggerEventSummary} → {l.proposedResultSummary}
                        </span>
                        <span className="font-mono tabular-nums shrink-0 text-[11px]">
                          {new Date(l.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
