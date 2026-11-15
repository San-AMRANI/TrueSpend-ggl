import assert from 'node:assert/strict';
import {
  ENTITLEMENTS_VERSION,
  FEATURE_ENTITLEMENTS,
  FEATURE_METADATA,
  getAdvancedOnlySummaryList,
  getTabRequiredFeature,
  hasFeatureAccess,
  isTabAvailableForUser,
  normalizeExperienceTier,
} from '../src/lib/entitlements.js';
import { STARTER_TEMPLATES } from '../server/services/TemplateService.js';
import { BASIC_PERMITTED_ACTIONS } from '../server/services/AiActionGateway.js';
import type { DashboardTab, FeatureKey } from '../src/types/index.js';

async function runTests() {
  // 1. Entitlements tier normalization & zero paid/billing gate check
  {
    assert.equal(ENTITLEMENTS_VERSION, 1);
    assert.equal(normalizeExperienceTier('basic'), 'basic');
    assert.equal(normalizeExperienceTier('advanced'), 'advanced');
    assert.equal(normalizeExperienceTier(undefined), 'advanced');
    assert.equal(normalizeExperienceTier(null), 'advanced');

    // No paid-tier or billing descriptions allowed
    for (const meta of Object.values(FEATURE_METADATA)) {
      const combined = `${meta.title} ${meta.description}`.toLowerCase();
      assert.equal(combined.includes('subscribe'), false);
      assert.equal(combined.includes('credit card'), false);
      assert.equal(combined.includes('upgrade to pro'), false);
    }
  }

  // 2. Basic vs Advanced feature matrix completeness
  {
    const basicCoreKeys: FeatureKey[] = [
      'dashboard.core',
      'transactions.core',
      'accounts.core',
      'budgets.core',
      'calendar.core',
      'debts.core',
      'goals.core',
      'subscriptions.core',
      'analytics.basic',
      'reports.basic',
      'ai.basic',
    ];
    for (const key of basicCoreKeys) {
      assert.equal(hasFeatureAccess('basic', key), true, `Expected ${key} in basic`);
      assert.equal(hasFeatureAccess('advanced', key), true, `Expected ${key} in advanced`);
    }

    const advancedKeys: FeatureKey[] = [
      'forecast.advanced',
      'simulator',
      'investments',
      'binance.integration',
      'statements.import',
      'review.inbox',
      'budgets.advanced',
      'debts.advanced',
      'goals.contributions',
      'contexts.advanced',
      'commitments.advanced',
      'rules.automation',
      'analytics.advanced',
      'reports.advanced',
      'ai.advanced',
      'backups.advanced',
    ];
    for (const key of advancedKeys) {
      assert.equal(hasFeatureAccess('basic', key), false, `Expected ${key} gated out of basic`);
      assert.equal(hasFeatureAccess('advanced', key), true, `Expected ${key} enabled in advanced`);
    }

    assert.equal(
      Object.keys(FEATURE_ENTITLEMENTS.basic).length,
      Object.keys(FEATURE_ENTITLEMENTS.advanced).length
    );
    assert.equal(getAdvancedOnlySummaryList().length, advancedKeys.length);
  }

  // 3. Tab gating across Basic vs Advanced vs Role
  {
    const coreTabs: DashboardTab[] = [
      'overview',
      'transactions',
      'accounts',
      'budgets',
      'calendar',
      'debts',
      'goals',
      'subscriptions',
      'analytics',
      'reports',
      'chat',
      'settings',
    ];
    for (const tab of coreTabs) {
      assert.equal(isTabAvailableForUser(tab, 'basic', 'member'), true);
      assert.equal(isTabAvailableForUser(tab, 'advanced', 'member'), true);
    }

    const advancedTabs: DashboardTab[] = ['investments', 'calculators', 'forecast', 'contexts'];
    for (const tab of advancedTabs) {
      assert.ok(getTabRequiredFeature(tab) !== null);
      assert.equal(isTabAvailableForUser(tab, 'basic', 'member'), false);
      assert.equal(isTabAvailableForUser(tab, 'basic', 'owner'), false);
      assert.equal(isTabAvailableForUser(tab, 'advanced', 'member'), true);
    }

    // Admin Users tab requires owner or admin role regardless of experience tier
    assert.equal(isTabAvailableForUser('users', 'advanced', 'member'), false);
    assert.equal(isTabAvailableForUser('users', 'advanced', 'viewer'), false);
    assert.equal(isTabAvailableForUser('users', 'basic', 'admin'), true);
    assert.equal(isTabAvailableForUser('users', 'advanced', 'owner'), true);
  }

  // 4. Starter Templates catalog invariants (both tiers are safe, previews intact, Basic never seeds Advanced records)
  {
    const basicTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'basic');
    const advancedTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'advanced');
    assert.ok(basicTemplates.length >= 6);
    assert.ok(advancedTemplates.length >= 6);

    const seenIds = new Set<string>();
    for (const tpl of STARTER_TEMPLATES) {
      assert.equal(seenIds.has(tpl.id), false, `Duplicate template id: ${tpl.id}`);
      seenIds.add(tpl.id);
      assert.ok(tpl.name.length > 0);
      assert.ok(tpl.summary.length > 10);
      assert.ok(tpl.whyUseful.length > 10);
      assert.ok(tpl.previewItems.length >= 1);

      if (tpl.tier === 'basic') {
        assert.equal(
          tpl.seed.contexts?.length || 0,
          0,
          `Basic template ${tpl.id} must not seed Advanced contexts`
        );
        const hasInvWallet = (tpl.seed.wallets || []).some((w) => w.type === 'Investment');
        assert.equal(hasInvWallet, false, `Basic template ${tpl.id} must not seed Investment wallet`);
      }
    }
  }

  // 5. Basic mode permits core AI action proposals while blocking Advanced-only stock actions
  {
    assert.equal(BASIC_PERMITTED_ACTIONS.has('create_transaction'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('upsert_budget'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('create_debt'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('settle_debt'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('create_goal'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('contribute_goal'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('confirm_payroll'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('update_settings'), true);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('buy_stock'), false);
    assert.equal(BASIC_PERMITTED_ACTIONS.has('record_dividend'), false);
  }

  console.log('✓ All entitlements, tier gating, and starter template catalog tests passed');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
