import { useCallback, useState } from 'react';
import type {
  CounterpartyRecord,
  ExchangeRateRecord,
  ExternalWealthItem,
  FinancialIntegrityReport,
  JournalAuditSummary,
  StatementBatchWithRows,
  WalletsWorkbenchSection,
} from '../types';
import { dashboardService } from '../services/api/dashboardService';
import { normalizeStatementImportResult } from '../lib/auditContracts';

export function useAccountAuditWorkbench(
  token: string | null,
  onDataChange?: () => Promise<void> | void
) {
  const [journalSummary, setJournalSummary] = useState<JournalAuditSummary | null>(null);
  const [statementBatches, setStatementBatches] = useState<StatementBatchWithRows[]>([]);
  const [externalWealth, setExternalWealth] = useState<ExternalWealthItem[]>([]);
  const [externalSummary, setExternalSummary] = useState<{
    totalExternalAssetsMad: number;
    totalExternalLiabilitiesMad: number;
    netExternalWealthMad: number;
  }>({ totalExternalAssetsMad: 0, totalExternalLiabilitiesMad: 0, netExternalWealthMad: 0 });
  const [fxRates, setFxRates] = useState<ExchangeRateRecord[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRecord[]>([]);
  const [integrityReport, setIntegrityReport] = useState<FinancialIntegrityReport | null>(null);
  const [loadingSection, setLoadingSection] = useState<WalletsWorkbenchSection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSection = useCallback(
    async (section: WalletsWorkbenchSection) => {
      if (!token || section === 'wallets' || section === 'review_inbox') return;
      setLoadingSection(section);
      setError(null);
      try {
        if (section === 'journal_audit') {
          const summary = await dashboardService.getJournalAuditSummary(token);
          setJournalSummary(summary);
        } else if (section === 'statement_import') {
          const batches = await dashboardService.getStatementBatches(token);
          setStatementBatches(Array.isArray(batches) ? batches : []);
        } else if (section === 'external_wealth_fx') {
          const [wealthRes, rates] = await Promise.all([
            dashboardService.getExternalWealthItems(token),
            dashboardService.getExchangeRates(token),
          ]);
          const items = Array.isArray(wealthRes) ? wealthRes : wealthRes?.items || [];
          setExternalWealth(items);
          setExternalSummary({
            totalExternalAssetsMad: Number(wealthRes?.totalExternalAssetsMad ?? 0),
            totalExternalLiabilitiesMad: Number(wealthRes?.totalExternalLiabilitiesMad ?? 0),
            netExternalWealthMad: Number(wealthRes?.netExternalWealthMad ?? 0),
          });
          setFxRates(Array.isArray(rates) ? rates : []);
        } else if (section === 'counterparties') {
          const list = await dashboardService.getCounterparties(token);
          setCounterparties(Array.isArray(list) ? list : []);
        } else if (section === 'integrity_diagnostics') {
          const report = await dashboardService.getFinancialIntegrityReport(token);
          setIntegrityReport(report);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load workbench panel data');
      } finally {
        setLoadingSection(null);
      }
    },
    [token]
  );

  const importStatement = useCallback(
    async (payload: {
      walletId: string;
      fileName: string;
      fileFormat?: string;
      rawContent: string;
      statementOpeningBalance?: number;
      statementClosingBalance?: number;
    }) => {
      if (!token) return null;
      setLoadingSection('statement_import');
      setError(null);
      try {
        const raw = await dashboardService.importStatementBatch(payload, token);
        const normalized = normalizeStatementImportResult(raw);
        await loadSection('statement_import');
        return normalized;
      } catch (err: any) {
        setError(err?.message || 'Failed to import statement batch');
        throw err;
      } finally {
        setLoadingSection(null);
      }
    },
    [token, loadSection]
  );

  const resolveRow = useCallback(
    async (
      rowId: string,
      payload: { action: 'confirm_match' | 'create_transaction' | 'ignore'; linkedTransactionId?: string; category?: string }
    ) => {
      if (!token) return null;
      setError(null);
      try {
        const updated = await dashboardService.resolveStatementRow(rowId, payload, token);
        await loadSection('statement_import');
        if (payload.action === 'create_transaction' || payload.action === 'confirm_match') {
          await onDataChange?.();
        }
        return updated;
      } catch (err: any) {
        setError(err?.message || 'Failed to resolve statement row');
        throw err;
      }
    },
    [token, loadSection, onDataChange]
  );

  const backfillJournal = useCallback(async () => {
    if (!token) return null;
    setLoadingSection('journal_audit');
    setError(null);
    try {
      const res = await dashboardService.backfillJournalEntries(token);
      if (res?.summary) setJournalSummary(res.summary);
      return res;
    } catch (err: any) {
      setError(err?.message || 'Journal backfill failed');
      throw err;
    } finally {
      setLoadingSection(null);
    }
  }, [token]);

  return {
    journalSummary,
    statementBatches,
    externalWealth,
    externalSummary,
    fxRates,
    counterparties,
    integrityReport,
    loadingSection,
    error,
    setError,
    loadSection,
    importStatement,
    resolveRow,
    backfillJournal,
  };
}
