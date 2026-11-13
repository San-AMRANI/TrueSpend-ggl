import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../src/middleware/auth.js';
import { coreAuditService } from '../services/CoreAuditService.js';

const router = Router();

// Item A: Double-Entry Accounting & Journal Audit
router.get('/audit/journal', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const summary = await coreAuditService.getJournalAuditSummary(authReq.dbUser.id);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load journal audit summary' });
  }
});

router.post('/audit/journal/backfill', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.backfillJournalFromTransactions(authReq.dbUser.id);
    const summary = await coreAuditService.getJournalAuditSummary(authReq.dbUser.id);
    res.json({ ...result, summary });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to backfill journal entries' });
  }
});

// Item C: Multi-Currency Historical Exchange Rates
router.get('/audit/fx-rates', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const rates = await coreAuditService.getExchangeRates(authReq.dbUser.id);
    res.json(rates.history || []);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch FX rates' });
  }
});

router.post('/audit/fx-rates', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const rate = await coreAuditService.upsertExchangeRate(authReq.dbUser.id, req.body);
    res.status(201).json(rate);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save FX rate' });
  }
});

// Item D: Statement CSV/XLSX/TSV Import & Transaction Matching
router.get('/audit/statements', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const batches = await coreAuditService.getStatementBatches(authReq.dbUser.id);
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load statement batches' });
  }
});

router.post('/audit/statements/import', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.importStatementBatch(authReq.dbUser.id, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to import statement batch' });
  }
});

router.post('/audit/statements/rows/:id/resolve', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.resolveStatementRow(authReq.dbUser.id, req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to resolve statement row' });
  }
});

// Item E: Persistent Financial Review Inbox
router.get('/audit/review-inbox', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const allItems = await coreAuditService.getReviewInbox(authReq.dbUser.id);
    const items = status ? allItems.filter((item) => item.status === status) : allItems;
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load review inbox' });
  }
});

router.post('/audit/review-inbox', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const item = await coreAuditService.createReviewItem(authReq.dbUser.id, req.body);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create review item' });
  }
});

router.post('/audit/review-inbox/:id/decide', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.decideReviewItem(authReq.dbUser.id, req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to process review decision' });
  }
});

// Item F: Commitment Occurrences (Subscriptions, Debt Installments, Payrolls, Planned Bills)
router.get('/audit/occurrences', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const occurrences = await coreAuditService.syncAndGetCommitmentOccurrences(authReq.dbUser.id);
    res.json(occurrences);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load commitment occurrences' });
  }
});

router.post('/audit/occurrences/:id/settle', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.settleCommitmentOccurrence(authReq.dbUser.id, req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to settle commitment occurrence' });
  }
});

// Item I: Goal Contribution Events
router.get('/audit/goal-events', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const goalId = typeof req.query.goalId === 'string' ? req.query.goalId : undefined;
    const events = await coreAuditService.getGoalContributionEvents(authReq.dbUser.id, goalId);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load goal contribution events' });
  }
});

// Item J: Saved & Comparable What-If Scenarios
router.get('/audit/scenarios', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const scenarios = await coreAuditService.getSavedScenarios(authReq.dbUser.id);
    res.json(scenarios);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load saved scenarios' });
  }
});

router.post('/audit/scenarios', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const scenario = await coreAuditService.saveScenario(authReq.dbUser.id, req.body);
    res.status(201).json(scenario);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save scenario' });
  }
});

router.delete('/audit/scenarios/:id', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.deleteScenario(authReq.dbUser.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to delete scenario' });
  }
});

// Item K: User-Configurable Constrained Financial Rules Engine
router.get('/audit/rules', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const data = await coreAuditService.getFinancialRules(authReq.dbUser.id);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load financial rules' });
  }
});

router.post('/audit/rules', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const rule = await coreAuditService.upsertFinancialRule(authReq.dbUser.id, req.body);
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save financial rule' });
  }
});

router.delete('/audit/rules/:id', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.deleteFinancialRule(authReq.dbUser.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to delete financial rule' });
  }
});

// Item L: External Wealth Items (Unified Net Worth)
router.get('/audit/external-wealth', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const items = await coreAuditService.getExternalWealthItems(authReq.dbUser.id);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load external wealth items' });
  }
});

router.post('/audit/external-wealth', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const item = await coreAuditService.upsertExternalWealthItem(authReq.dbUser.id, req.body);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save external wealth item' });
  }
});

router.delete('/audit/external-wealth/:id', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.deleteExternalWealthItem(authReq.dbUser.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to delete external wealth item' });
  }
});

// Item F extension: Recurring non-payroll income commitments
router.post('/audit/occurrences/income', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const created = await coreAuditService.createRecurringIncomeCommitment(authReq.dbUser.id, req.body);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create recurring income commitment' });
  }
});

// Item K extension: Dry-run rule preview without side effects
router.post('/audit/rules/dry-run', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.dryRunFinancialRule(authReq.dbUser.id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to preview rule' });
  }
});

// Item 3: Whole Financial Position History & Net Worth Change Bridge
router.get('/audit/position-history', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const data = await coreAuditService.getFinancialPositionHistory(authReq.dbUser.id);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load position history' });
  }
});

router.post('/audit/position-snapshot', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const snapshot = await coreAuditService.captureFinancialPositionSnapshot(authReq.dbUser.id, 'manual');
    res.status(201).json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to capture financial position snapshot' });
  }
});

// Item 4: Counterparty & Merchant Identity Layer
router.get('/audit/counterparties', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const list = await coreAuditService.getCounterparties(authReq.dbUser.id);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load counterparties' });
  }
});

router.post('/audit/counterparties', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const item = await coreAuditService.upsertCounterparty(authReq.dbUser.id, req.body);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to save counterparty' });
  }
});

router.post('/audit/counterparties/merge', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const result = await coreAuditService.mergeCounterparties(authReq.dbUser.id, req.body.sourceId, req.body.targetId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to merge counterparties' });
  }
});

// Item 7: Operational Diagnostics & Financial Integrity Report
router.get('/audit/integrity-report', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const report = await coreAuditService.getFinancialIntegrityReport(authReq.dbUser.id);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to compute integrity report' });
  }
});

export default router;
