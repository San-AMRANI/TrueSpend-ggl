import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  wallets,
  categoryBudgets,
  goals,
  subscriptions,
  financialContexts,
  users,
  templateApplications,
  payrolls,
} from '../../src/db/schema.js';
import { normalizeExperienceTier } from '../../src/lib/entitlements.js';
import { getCurrentFinancialMonth } from '../../src/lib/financialMonth.js';
import type { ExperienceTier, StarterTemplate } from '../../src/types/index.js';

interface TemplateSeedDefinition {
  id: string;
  version: number;
  tier: ExperienceTier;
  category: StarterTemplate['category'];
  name: string;
  summary: string;
  whyUseful: string;
  previewItems: StarterTemplate['previewItems'];
  seed: {
    wallets?: Array<{ name: string; type: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }>;
    budgets?: Array<{ category: string; monthlyLimit: number }>;
    goals?: Array<{ name: string; targetAmount: number; category: string; notes: string }>;
    subscriptions?: Array<{ name: string; amount: number; billingCycle: string; category: string; icon: string }>;
    contexts?: Array<{ name: string; type: 'Trip' | 'Work / Mission' | 'Project' | 'Life Event' | 'Other'; budget: number; notes: string }>;
    preferences?: { emergencyBuffer?: number };
  };
}

export const STARTER_TEMPLATES: TemplateSeedDefinition[] = [
  {
    id: 'basic-simple-monthly',
    version: 1,
    tier: 'basic',
    category: 'budgeting',
    name: 'Simple Monthly Budget',
    summary: 'Five everyday category limits covering housing, groceries, transport, utilities, and dining.',
    whyUseful: 'Gives you immediate spending guardrails without complex sub-categories.',
    previewItems: [
      { kind: 'budget', title: 'Housing & Rent', detail: '3,000 monthly target' },
      { kind: 'budget', title: 'Groceries', detail: '1,800 monthly target' },
      { kind: 'budget', title: 'Transport', detail: '600 monthly target' },
      { kind: 'budget', title: 'Bills & Utilities', detail: '500 monthly target' },
      { kind: 'budget', title: 'Dining Out & Coffee', detail: '700 monthly target' },
    ],
    seed: {
      budgets: [
        { category: '🏠 Housing & Rent', monthlyLimit: 3000 },
        { category: '🛒 Groceries', monthlyLimit: 1800 },
        { category: '🚗 Transport', monthlyLimit: 600 },
        { category: '💡 Bills & Utilities', monthlyLimit: 500 },
        { category: '🍔 Dining Out & Coffee', monthlyLimit: 700 },
      ],
    },
  },
  {
    id: 'basic-50-30-20',
    version: 1,
    tier: 'basic',
    category: 'budgeting',
    name: '50/30/20 Starter Budget',
    summary: 'Balances essential living costs, flexible lifestyle spending, and a dedicated monthly savings target.',
    whyUseful: 'Ideal if you want a proven rule-of-thumb split tailored around your payday cycle.',
    previewItems: [
      { kind: 'budget', title: 'Essentials (Housing, Food & Bills)', detail: '50% guideline' },
      { kind: 'budget', title: 'Personal & Lifestyle', detail: '30% guideline' },
      { kind: 'budget', title: 'Savings & Emergency Target', detail: '20% guideline' },
      { kind: 'goal', title: '20% Monthly Reserve', detail: 'Savings milestone' },
    ],
    seed: {
      budgets: [
        { category: '🏠 Housing & Rent', monthlyLimit: 2500 },
        { category: '🛒 Groceries', monthlyLimit: 1500 },
        { category: '🛍️ Shopping & Lifestyle', monthlyLimit: 1500 },
        { category: '🛟 Emergency & goals Fund', monthlyLimit: 1500 },
      ],
      goals: [
        {
          name: '20% Monthly Savings Cushion',
          targetAmount: 10000,
          category: 'Emergency Fund',
          notes: 'Created from 50/30/20 Starter Budget template',
        },
      ],
    },
  },
  {
    id: 'basic-payday-budget',
    version: 1,
    tier: 'basic',
    category: 'budgeting',
    name: 'Payday-Based Budget',
    summary: 'Sets up core living, bill, and reserve limits aligned around monthly salary cycles.',
    whyUseful: 'Keeps your safe-to-spend balance realistic between salary deposits.',
    previewItems: [
      { kind: 'budget', title: 'Fixed Bills & Utilities', detail: '1,200 monthly target' },
      { kind: 'budget', title: 'Everyday Spending', detail: '2,200 monthly target' },
      { kind: 'preference', title: 'Safety Buffer Baseline', detail: '1,000 minimum cushion' },
    ],
    seed: {
      budgets: [
        { category: '💡 Bills & Utilities', monthlyLimit: 1200 },
        { category: '🛒 Groceries', monthlyLimit: 2200 },
      ],
      preferences: { emergencyBuffer: 1000 },
    },
  },
  {
    id: 'basic-essential-accounts',
    version: 1,
    tier: 'basic',
    category: 'accounts',
    name: 'Essential Accounts Setup',
    summary: 'Creates your clean three-account foundation: Main Bank, Cash Wallet, and Emergency Savings.',
    whyUseful: 'Separates daily card spending from pocket cash and long-term reserves.',
    previewItems: [
      { kind: 'wallet', title: 'Main Bank', detail: 'Primary checking account' },
      { kind: 'wallet', title: 'Cash Wallet', detail: 'Physical pocket cash' },
      { kind: 'wallet', title: 'Savings Vault', detail: 'Dedicated reserve account' },
    ],
    seed: {
      wallets: [
        { name: 'Main Bank', type: 'Bank', isMain: true, initialBalance: 0 },
        { name: 'Cash Wallet', type: 'Cash', isMain: false, initialBalance: 0 },
        { name: 'Savings Vault', type: 'Savings', isMain: false, initialBalance: 0 },
      ],
    },
  },
  {
    id: 'basic-first-savings-goal',
    version: 1,
    tier: 'basic',
    category: 'goals',
    name: 'First Savings Goal',
    summary: 'Adds a clear 1-month emergency reserve goal linked to your Savings account.',
    whyUseful: 'Turns abstract saving into a measurable target with progress tracking.',
    previewItems: [
      { kind: 'goal', title: 'Starter Emergency Cushion', detail: '5,000 savings target' },
    ],
    seed: {
      goals: [
        {
          name: 'Starter Emergency Cushion',
          targetAmount: 5000,
          category: 'Emergency Fund',
          notes: 'First 1-month buffer target',
        },
      ],
    },
  },
  {
    id: 'basic-recurring-bills',
    version: 1,
    tier: 'basic',
    category: 'bills',
    name: 'Recurring Bills Checklist',
    summary: 'Preloads two common recurring reminders (Mobile/Fiber Internet and Electricity & Water) you can adjust.',
    whyUseful: 'Prevents surprise renewals by surfacing upcoming fixed obligations.',
    previewItems: [
      { kind: 'subscription', title: 'Internet & Mobile Plan', detail: '249 monthly reminder' },
      { kind: 'subscription', title: 'Electricity & Water Utility', detail: '300 monthly reminder' },
    ],
    seed: {
      subscriptions: [
        {
          name: 'Internet & Mobile Plan',
          amount: 249,
          billingCycle: 'monthly',
          category: '📱 Telecom & Subscriptions',
          icon: '📶',
        },
        {
          name: 'Electricity & Water Utility',
          amount: 300,
          billingCycle: 'monthly',
          category: '🏢 Housing & Utilities',
          icon: '💡',
        },
      ],
    },
  },
  {
    id: 'adv-envelope-budget',
    version: 1,
    tier: 'advanced',
    category: 'budgeting',
    name: 'Advanced Envelope Budget',
    summary: 'Comprehensive category envelopes covering fixed housing, food, transport, healthcare, sinking funds, and discretionary fun.',
    whyUseful: 'Built for granular monthly allocation discipline across every category.',
    previewItems: [
      { kind: 'budget', title: 'Housing, Groceries, Utilities, Transport', detail: 'Core living envelopes' },
      { kind: 'budget', title: 'Health, Personal, Entertainment & Reserve', detail: 'Planned sinking envelopes' },
    ],
    seed: {
      budgets: [
        { category: '🏠 Housing & Rent', monthlyLimit: 3200 },
        { category: '🛒 Groceries', monthlyLimit: 1800 },
        { category: '💡 Bills & Utilities', monthlyLimit: 650 },
        { category: '🚗 Transport', monthlyLimit: 700 },
        { category: '🏥 Healthcare & Pharmacy', monthlyLimit: 450 },
        { category: '🛍️ Shopping & Lifestyle', monthlyLimit: 800 },
        { category: '🛟 Emergency & goals Fund', monthlyLimit: 1500 },
      ],
    },
  },
  {
    id: 'adv-financial-safety',
    version: 1,
    tier: 'advanced',
    category: 'planning',
    name: 'Financial Safety Plan',
    summary: 'Establishes a 3-to-6 month emergency vault, minimum safety buffer, and dedicated protection reserve goal.',
    whyUseful: 'Protects your forecast and runway against unexpected income interruptions.',
    previewItems: [
      { kind: 'wallet', title: 'Emergency Reserve Vault', detail: 'Dedicated Savings account' },
      { kind: 'goal', title: '3-Month Emergency Reserve', detail: '18,000 target fund' },
      { kind: 'preference', title: 'Emergency Floor Alert', detail: '3,000 warning threshold' },
    ],
    seed: {
      wallets: [{ name: 'Emergency Reserve Vault', type: 'Savings', isMain: false, initialBalance: 0 }],
      goals: [
        {
          name: '3-Month Emergency Reserve',
          targetAmount: 18000,
          category: 'Emergency Fund',
          notes: 'Three months of essential household expenses',
        },
      ],
      preferences: { emergencyBuffer: 3000 },
    },
  },
  {
    id: 'adv-debt-repayment',
    version: 1,
    tier: 'advanced',
    category: 'planning',
    name: 'Debt Repayment Planner',
    summary: 'Adds a dedicated monthly debt paydown envelope and debt-freedom milestone goal.',
    whyUseful: 'Pairs with APR and snowball calculators to accelerate becoming debt-free.',
    previewItems: [
      { kind: 'budget', title: 'Debt Repayment Allocation', detail: '1,200 monthly paydown target' },
      { kind: 'goal', title: 'Debt-Free Acceleration Fund', detail: '12,000 milestone' },
    ],
    seed: {
      budgets: [{ category: '💳 Debt Repayment', monthlyLimit: 1200 }],
      goals: [
        {
          name: 'Debt-Free Acceleration Fund',
          targetAmount: 12000,
          category: 'Debt Payoff',
          notes: 'Extra principal payoff reserve',
        },
      ],
    },
  },
  {
    id: 'adv-long-term-savings',
    version: 1,
    tier: 'advanced',
    category: 'goals',
    name: 'Long-Term Savings Plan',
    summary: 'Creates a High-Yield Vault plus two long-horizon goals for major milestones and annual travel.',
    whyUseful: 'Separates long-horizon wealth goals from short-term spending cash.',
    previewItems: [
      { kind: 'wallet', title: 'High-Yield Savings', detail: 'Long-term savings account' },
      { kind: 'goal', title: 'Major Milestone Fund', detail: '50,000 target' },
      { kind: 'goal', title: 'Annual Travel Sinking Fund', detail: '10,000 target' },
    ],
    seed: {
      wallets: [{ name: 'High-Yield Savings', type: 'Savings', isMain: false, initialBalance: 0 }],
      goals: [
        {
          name: 'Major Milestone Fund',
          targetAmount: 50000,
          category: 'Long-Term Savings',
          notes: 'Down payment, business or major life milestone',
        },
        {
          name: 'Annual Travel Sinking Fund',
          targetAmount: 10000,
          category: 'Travel',
          notes: 'Planned holidays without touching emergency savings',
        },
      ],
    },
  },
  {
    id: 'adv-investment-setup',
    version: 1,
    tier: 'advanced',
    category: 'investing',
    name: 'Investment Tracking Setup',
    summary: 'Sets up an Investment Brokerage account and a monthly portfolio allocation budget.',
    whyUseful: 'Readies your private workspace for tracking stock positions, dividends, and DCA.',
    previewItems: [
      { kind: 'wallet', title: 'Investment Brokerage', detail: 'Investment wallet' },
      { kind: 'budget', title: 'Monthly Portfolio Contribution', detail: '1,000 monthly DCA' },
    ],
    seed: {
      wallets: [{ name: 'Investment Brokerage', type: 'Investment', isMain: false, initialBalance: 0 }],
      budgets: [{ category: '📈 Investments & DCA', monthlyLimit: 1000 }],
    },
  },
  {
    id: 'adv-life-event-context',
    version: 1,
    tier: 'advanced',
    category: 'planning',
    name: 'Life Event / Trip Budget',
    summary: 'Creates an isolated Financial Context workspace so trip or event costs do not distort regular months.',
    whyUseful: 'Ideal for weddings, relocation, conferences, or holidays.',
    previewItems: [
      { kind: 'context', title: 'Planned Trip / Life Event', detail: 'Dedicated 8,000 context budget' },
    ],
    seed: {
      contexts: [
        {
          name: 'Upcoming Trip / Event Budget',
          type: 'Trip',
          budget: 8000,
          notes: 'Template context — rename or adjust dates to match your trip or event.',
        },
      ],
    },
  },
];

export class TemplateService {
  async listTemplates(userId: string, userTier: ExperienceTier): Promise<StarterTemplate[]> {
    const apps = await db
      .select()
      .from(templateApplications)
      .where(eq(templateApplications.userId, userId));

    const appliedMap = new Map(apps.map((a) => [a.templateId, a]));

    return STARTER_TEMPLATES.filter((t) => userTier === 'advanced' || t.tier === 'basic').map(
      (t) => {
        const applied = appliedMap.get(t.id);
        return {
          id: t.id,
          version: t.version,
          tier: t.tier,
          category: t.category,
          name: t.name,
          summary: t.summary,
          whyUseful: t.whyUseful,
          alreadyApplied: Boolean(applied),
          appliedAt: applied?.appliedAt ? new Date(applied.appliedAt).toISOString() : null,
          previewItems: t.previewItems,
        };
      }
    );
  }

  async previewTemplate(templateId: string, userId: string, userTier: ExperienceTier) {
    const list = await this.listTemplates(userId, userTier);
    const found = list.find((t) => t.id === templateId);
    if (!found) {
      throw new Error('Starter template not found or requires the Advanced experience tier.');
    }
    return found;
  }

  async applyTemplate(userId: string, userTier: string | null | undefined, templateId: string) {
    const normalizedTier = normalizeExperienceTier(userTier);
    const def = STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (!def) {
      throw new Error('Template not found.');
    }
    if (def.tier === 'advanced' && normalizedTier !== 'advanced') {
      const err: any = new Error(
        `${def.name} belongs to the Advanced experience. Switch to Advanced (free) to apply it.`
      );
      err.code = 'FEATURE_NOT_AVAILABLE_FOR_TIER';
      err.status = 403;
      throw err;
    }

    const now = new Date();
    const userPayrolls = await db
      .select()
      .from(payrolls)
      .where(eq(payrolls.userId, userId));
    const currentFm = getCurrentFinancialMonth(userPayrolls, now);
    const month = currentFm ? currentFm.month : now.getMonth() + 1;
    const year = currentFm ? currentFm.year : now.getFullYear();

    return await db.transaction(async (txDb) => {
      const existingApp = await txDb
        .select()
        .from(templateApplications)
        .where(
          and(
            eq(templateApplications.userId, userId),
            eq(templateApplications.templateId, templateId)
          )
        )
        .limit(1);

      if (existingApp.length > 0) {
        return {
          alreadyApplied: true,
          appliedAt: existingApp[0].appliedAt,
          createdResources: [],
          message: `"${def.name}" has already been applied to your workspace.`,
        };
      }

      const createdResources: Array<{ kind: string; id: string; name: string }> = [];

      if (def.seed.wallets?.length) {
        const existingWallets = await txDb
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId));
        const existingNames = new Set(existingWallets.map((w) => w.name.toLowerCase()));
        const hasMain = existingWallets.some((w) => w.isMain);

        for (const w of def.seed.wallets) {
          if (existingNames.has(w.name.toLowerCase())) continue;
          const [insertedWallet] = await txDb
            .insert(wallets)
            .values({
              userId,
              name: w.name,
              type: w.type,
              accountSubtype: w.type === 'Bank' ? 'Checking' : w.type,
              isMain: !hasMain && Boolean(w.isMain),
              initialBalance: String(w.initialBalance ?? 0),
              currentBalance: String(w.initialBalance ?? 0),
            })
            .returning();
          createdResources.push({ kind: 'wallet', id: insertedWallet.id, name: insertedWallet.name });
        }
      }

      if (def.seed.budgets?.length) {
        const existingBudgets = await txDb
          .select()
          .from(categoryBudgets)
          .where(
            and(
              eq(categoryBudgets.userId, userId),
              eq(categoryBudgets.month, month),
              eq(categoryBudgets.year, year)
            )
          );
        const existingCategories = new Set(existingBudgets.map((b) => b.category.toLowerCase()));

        for (const b of def.seed.budgets) {
          if (existingCategories.has(b.category.toLowerCase())) continue;
          const [insertedBudget] = await txDb
            .insert(categoryBudgets)
            .values({
              userId,
              category: b.category,
              amount: String(b.monthlyLimit),
              month,
              year,
            })
            .returning();
          createdResources.push({ kind: 'budget', id: insertedBudget.id, name: insertedBudget.category });
        }
      }

      if (def.seed.goals?.length) {
        const existingGoals = await txDb.select().from(goals).where(eq(goals.userId, userId));
        const existingNames = new Set(existingGoals.map((g) => g.name.toLowerCase()));
        for (const g of def.seed.goals) {
          if (existingNames.has(g.name.toLowerCase())) continue;
          const [insertedGoal] = await txDb
            .insert(goals)
            .values({
              userId,
              name: g.name,
              targetAmount: String(g.targetAmount),
              currentAmount: '0',
              category: g.category,
              notes: g.notes,
            })
            .returning();
          createdResources.push({ kind: 'goal', id: insertedGoal.id, name: insertedGoal.name });
        }
      }

      if (def.seed.subscriptions?.length) {
        const existingSubs = await txDb
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId));
        const existingNames = new Set(existingSubs.map((s) => s.name.toLowerCase()));
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        for (const s of def.seed.subscriptions) {
          if (existingNames.has(s.name.toLowerCase())) continue;
          const [insertedSub] = await txDb
            .insert(subscriptions)
            .values({
              userId,
              name: s.name,
              amount: String(s.amount),
              billingCycle: s.billingCycle,
              category: s.category,
              icon: s.icon,
              status: 'planned',
              nextBillingDate: nextMonth,
              notes: 'Added from Starter Template — edit amount & due date anytime',
            })
            .returning();
          createdResources.push({
            kind: 'subscription',
            id: insertedSub.id,
            name: insertedSub.name,
          });
        }
      }

      if (def.seed.contexts?.length) {
        const existingCtxs = await txDb
          .select()
          .from(financialContexts)
          .where(eq(financialContexts.userId, userId));
        const existingNames = new Set(existingCtxs.map((c) => c.name.toLowerCase()));
        for (const c of def.seed.contexts) {
          if (existingNames.has(c.name.toLowerCase())) continue;
          const [insertedCtx] = await txDb
            .insert(financialContexts)
            .values({
              userId,
              name: c.name,
              type: c.type,
              budget: String(c.budget),
              status: 'Planned',
              notes: c.notes,
            })
            .returning();
          createdResources.push({ kind: 'context', id: insertedCtx.id, name: insertedCtx.name });
        }
      }

      if (def.seed.preferences?.emergencyBuffer !== undefined) {
        const [uRow] = await txDb
          .select({
            emergencyBuffer: users.emergencyBuffer,
            onboardingStepsJson: users.onboardingStepsJson,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const existingBuf = Number(uRow?.emergencyBuffer || 0);
        let completedSteps: string[] = [];
        try {
          completedSteps = JSON.parse(uRow?.onboardingStepsJson || '[]');
        } catch {
          completedSteps = [];
        }
        const accountsAlreadyCalibrated = completedSteps.includes('setup_accounts');
        if (existingBuf === 0 && !accountsAlreadyCalibrated) {
          await txDb
            .update(users)
            .set({ emergencyBuffer: String(def.seed.preferences.emergencyBuffer) })
            .where(eq(users.id, userId));
        }
      }

      const [appRecord] = await txDb
        .insert(templateApplications)
        .values({
          userId,
          templateId: def.id,
          templateVersion: def.version,
          createdResourceIdsJson: JSON.stringify(createdResources),
        })
        .returning();

      return {
        alreadyApplied: false,
        appliedAt: appRecord.appliedAt,
        createdResources,
        message: `Applied "${def.name}" (${createdResources.length} item${createdResources.length === 1 ? '' : 's'} created).`,
      };
    });
  }
}

export const templateService = new TemplateService();
