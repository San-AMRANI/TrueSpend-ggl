export const expenseCategories = [
  '🏠 Household & Family',
  '🏢 Housing & Utilities',
  '🛒 Groceries',
  '🍔 Dining & Takeaway',
  '☕ Coffee & Quick Food',
  '🚗 Transportation',
  '👕 Personal & Clothing',
  '📱 Telecom & Subscriptions',
  '🎬 Entertainment',
  '👥 Social',
  '🩺 Health & Medical',
  '🛡️ Insurance / Annual Costs',
  '💳 Debt & Obligations',
  '⚠️ Unexpected',
  '🛟 Emergency & goals Fund',
  '📈 Investments',
] as const;

export const incomeAndTransferCategories = [
  '📥 Income',
  '🤝 Loan Received',
  '🔄 Transfer',
  '🔙 Reimbursement',
] as const;

const categoryKey = (category: string) =>
  category
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\//g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const canonicalCategories = [...expenseCategories, ...incomeAndTransferCategories];

const canonicalByKey = new Map(canonicalCategories.map((category) => [categoryKey(category), category]));

const aliases = new Map<string, string>([
  // Household & Family (and legacy Family & Gifts, Education)
  ['household', '🏠 Household & Family'],
  ['family', '🏠 Household & Family'],
  ['household family', '🏠 Household & Family'],
  ['household and family', '🏠 Household & Family'],
  ['family and gifts', '🏠 Household & Family'],
  ['family expenses', '🏠 Household & Family'],
  ['family and kids', '🏠 Household & Family'],
  ['kids', '🏠 Household & Family'],
  ['children', '🏠 Household & Family'],
  ['gift', '🏠 Household & Family'],
  ['gifts', '🏠 Household & Family'],
  ['birthday', '🏠 Household & Family'],
  ['baby', '🏠 Household & Family'],
  ['education', '🏠 Household & Family'],
  ['education and development', '🏠 Household & Family'],
  ['books', '🏠 Household & Family'],
  ['school', '🏠 Household & Family'],

  // Housing & Utilities
  ['housing', '🏢 Housing & Utilities'],
  ['housing utilities', '🏢 Housing & Utilities'],
  ['housing and utilities', '🏢 Housing & Utilities'],
  ['rent', '🏢 Housing & Utilities'],
  ['housing rent', '🏢 Housing & Utilities'],
  ['housing and rent', '🏢 Housing & Utilities'],
  ['utilities', '🏢 Housing & Utilities'],
  ['bills', '🏢 Housing & Utilities'],
  ['electricity', '🏢 Housing & Utilities'],
  ['water', '🏢 Housing & Utilities'],
  ['syndic', '🏢 Housing & Utilities'],
  ['maintenance', '🏢 Housing & Utilities'],

  // Groceries
  ['groceries', '🛒 Groceries'],
  ['grocery', '🛒 Groceries'],
  ['supermarket', '🛒 Groceries'],
  ['carrefour', '🛒 Groceries'],
  ['marjane', '🛒 Groceries'],
  ['bim', '🛒 Groceries'],
  ['market', '🛒 Groceries'],

  // Dining & Takeaway
  ['food', '🍔 Dining & Takeaway'],
  ['foods', '🍔 Dining & Takeaway'],
  ['dining', '🍔 Dining & Takeaway'],
  ['food and dining', '🍔 Dining & Takeaway'],
  ['dining and takeaway', '🍔 Dining & Takeaway'],
  ['restaurant', '🍔 Dining & Takeaway'],
  ['restaurants', '🍔 Dining & Takeaway'],
  ['eat out', '🍔 Dining & Takeaway'],
  ['takeaway', '🍔 Dining & Takeaway'],
  ['fast food', '🍔 Dining & Takeaway'],
  ['delivery', '🍔 Dining & Takeaway'],
  ['glovo', '🍔 Dining & Takeaway'],

  // Coffee & Quick Food
  ['coffee', '☕ Coffee & Quick Food'],
  ['coffee shop', '☕ Coffee & Quick Food'],
  ['coffee and quick food', '☕ Coffee & Quick Food'],
  ['cafe', '☕ Coffee & Quick Food'],
  ['café', '☕ Coffee & Quick Food'],
  ['quick food', '☕ Coffee & Quick Food'],
  ['snacks', '☕ Coffee & Quick Food'],
  ['bakery', '☕ Coffee & Quick Food'],
  ['patisserie', '☕ Coffee & Quick Food'],

  // Transportation
  ['transport', '🚗 Transportation'],
  ['transportation', '🚗 Transportation'],
  ['transportation and fuel', '🚗 Transportation'],
  ['fuel', '🚗 Transportation'],
  ['gas', '🚗 Transportation'],
  ['petrol', '🚗 Transportation'],
  ['essence', '🚗 Transportation'],
  ['diesel', '🚗 Transportation'],
  ['taxi', '🚗 Transportation'],
  ['uber', '🚗 Transportation'],
  ['careem', '🚗 Transportation'],
  ['tram', '🚗 Transportation'],
  ['train', '🚗 Transportation'],
  ['parking', '🚗 Transportation'],
  ['mechanic', '🚗 Transportation'],

  // Personal & Clothing
  ['wardrobe', '👕 Personal & Clothing'],
  ['clothing', '👕 Personal & Clothing'],
  ['clothes', '👕 Personal & Clothing'],
  ['shopping', '👕 Personal & Clothing'],
  ['grooming', '👕 Personal & Clothing'],
  ['personal care', '👕 Personal & Clothing'],
  ['personal and clothing', '👕 Personal & Clothing'],
  ['barber', '👕 Personal & Clothing'],
  ['barbershop', '👕 Personal & Clothing'],
  ['salon', '👕 Personal & Clothing'],
  ['spa', '👕 Personal & Clothing'],
  ['cosmetics', '👕 Personal & Clothing'],

  // Telecom & Subscriptions
  ['telecom', '📱 Telecom & Subscriptions'],
  ['telecom and subscriptions', '📱 Telecom & Subscriptions'],
  ['phone', '📱 Telecom & Subscriptions'],
  ['mobile', '📱 Telecom & Subscriptions'],
  ['internet', '📱 Telecom & Subscriptions'],
  ['wifi', '📱 Telecom & Subscriptions'],
  ['fibre', '📱 Telecom & Subscriptions'],
  ['inwi', '📱 Telecom & Subscriptions'],
  ['iam', '📱 Telecom & Subscriptions'],
  ['orange', '📱 Telecom & Subscriptions'],
  ['subscriptions', '📱 Telecom & Subscriptions'],
  ['subscription', '📱 Telecom & Subscriptions'],
  ['netflix', '📱 Telecom & Subscriptions'],
  ['spotify', '📱 Telecom & Subscriptions'],
  ['icloud', '📱 Telecom & Subscriptions'],

  // Entertainment
  ['entertainment', '🎬 Entertainment'],
  ['movies', '🎬 Entertainment'],
  ['cinema', '🎬 Entertainment'],
  ['games', '🎬 Entertainment'],
  ['gaming', '🎬 Entertainment'],
  ['steam', '🎬 Entertainment'],
  ['playstation', '🎬 Entertainment'],
  ['hobbies', '🎬 Entertainment'],
  ['hobby', '🎬 Entertainment'],
  ['concert', '🎬 Entertainment'],

  // Social
  ['social', '👥 Social'],
  ['socializing', '👥 Social'],
  ['outings', '👥 Social'],
  ['friends', '👥 Social'],
  ['party', '👥 Social'],
  ['events', '👥 Social'],

  // Health & Medical
  ['medical', '🩺 Health & Medical'],
  ['health', '🩺 Health & Medical'],
  ['health and medical', '🩺 Health & Medical'],
  ['health fitness', '🩺 Health & Medical'],
  ['medical expenses', '🩺 Health & Medical'],
  ['pharmacy', '🩺 Health & Medical'],
  ['doctor', '🩺 Health & Medical'],
  ['dentist', '🩺 Health & Medical'],
  ['hospital', '🩺 Health & Medical'],
  ['clinic', '🩺 Health & Medical'],
  ['gym', '🩺 Health & Medical'],
  ['fitness', '🩺 Health & Medical'],

  // Insurance / Annual Costs
  ['insurance', '🛡️ Insurance / Annual Costs'],
  ['annual costs', '🛡️ Insurance / Annual Costs'],
  ['insurance and annual costs', '🛡️ Insurance / Annual Costs'],
  ['insurance annual costs', '🛡️ Insurance / Annual Costs'],
  ['assurance', '🛡️ Insurance / Annual Costs'],
  ['car insurance', '🛡️ Insurance / Annual Costs'],
  ['health insurance', '🛡️ Insurance / Annual Costs'],
  ['mutuelle', '🛡️ Insurance / Annual Costs'],
  ['vignette', '🛡️ Insurance / Annual Costs'],
  ['taxes', '🛡️ Insurance / Annual Costs'],

  // Debt & Obligations
  ['debt repayment', '💳 Debt & Obligations'],
  ['repayment', '💳 Debt & Obligations'],
  ['loan', '💳 Debt & Obligations'],
  ['debt', '💳 Debt & Obligations'],
  ['debts', '💳 Debt & Obligations'],
  ['debt and obligations', '💳 Debt & Obligations'],
  ['credit', '💳 Debt & Obligations'],
  ['credit card', '💳 Debt & Obligations'],
  ['borrowed', '💳 Debt & Obligations'],

  // Unexpected
  ['unexpected', '⚠️ Unexpected'],
  ['emergency', '⚠️ Unexpected'],
  ['unplanned', '⚠️ Unexpected'],
  ['urgent', '⚠️ Unexpected'],
  ['repair', '⚠️ Unexpected'],

  // Emergency & goals Fund (and legacy Savings & Goals)
  ['savings', '🛟 Emergency & goals Fund'],
  ['savings and goals', '🛟 Emergency & goals Fund'],
  ['savings fund', '🛟 Emergency & goals Fund'],
  ['emergency and goals', '🛟 Emergency & goals Fund'],
  ['emergency and goals fund', '🛟 Emergency & goals Fund'],
  ['emergency goals fund', '🛟 Emergency & goals Fund'],
  ['emergency fund', '🛟 Emergency & goals Fund'],
  ['goal', '🛟 Emergency & goals Fund'],
  ['goals', '🛟 Emergency & goals Fund'],
  ['vault', '🛟 Emergency & goals Fund'],

  // Investments
  ['investment', '📈 Investments'],
  ['investments', '📈 Investments'],
  ['investments and brokerage', '📈 Investments'],
  ['investments brokerage', '📈 Investments'],
  ['stocks and crypto', '📈 Investments'],
  ['stocks crypto', '📈 Investments'],
  ['stocks', '📈 Investments'],
  ['crypto', '📈 Investments'],
  ['trading', '📈 Investments'],
  ['brokerage', '📈 Investments'],
  ['etf', '📈 Investments'],
  ['etfs', '📈 Investments'],
  ['binance', '📈 Investments'],
  ['ibkr', '📈 Investments'],
  ['bourse', '📈 Investments'],
  ['crypto purchase', '📈 Investments'],
  ['investment funding', '📈 Investments'],

  // Income
  ['salary', '📥 Income'],
  ['income', '📥 Income'],
  ['income salary', '📥 Income'],
  ['refund', '📥 Income'],
  ['other income', '📥 Income'],
  ['loan received', '🤝 Loan Received'],

  // Transfer
  ['transfer', '🔄 Transfer'],
  ['atm', '🔄 Transfer'],

  // Reimbursement
  ['reimbursement', '🔙 Reimbursement'],
]);

/**
 * Returns a fixed category label for new writes and analytics. Legacy values that do not
 * have a direct name change are mapped to their new canonical equivalent, ensuring historical
 * transaction rows and analytics remain 100% consistent and intact.
 */
export const normalizeCategory = (category?: string | null): string => {
  const trimmedCategory = category?.trim().replace(/\s+/g, ' ') ?? '';
  if (!trimmedCategory) return '';

  const key = categoryKey(trimmedCategory);
  return canonicalByKey.get(key) ?? aliases.get(key) ?? trimmedCategory;
};
