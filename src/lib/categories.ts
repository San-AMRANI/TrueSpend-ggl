export const expenseCategories = [
  '🏠 Housing & Utilities',
  '🛒 Groceries',
  '🍔 Dining & Takeaway',
  '☕ Coffee & Quick Food',
  '🚗 Transportation',
  '📱 Telecom & Subscriptions',
  '🩺 Health & Medical',
  '👕 Personal & Clothing',
  '🎬 Entertainment',
  '👥 Social',
  '👨‍👩‍👦 Family & Gifts',
  '📚 Education & Development',
  '💳 Debt & Obligations',
  '💰 Savings & Goals',
  '🚨 Unexpected',
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
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const canonicalCategories = [...expenseCategories, ...incomeAndTransferCategories];

const canonicalByKey = new Map(canonicalCategories.map((category) => [categoryKey(category), category]));

const aliases = new Map<string, string>([
  // Housing
  ['rent', '🏠 Housing & Utilities'],
  ['housing', '🏠 Housing & Utilities'],
  ['housing rent', '🏠 Housing & Utilities'],
  ['housing and rent', '🏠 Housing & Utilities'],
  ['utilities', '🏠 Housing & Utilities'],
  ['bills', '🏠 Housing & Utilities'],
  // Groceries
  ['groceries', '🛒 Groceries'],
  ['supermarket', '🛒 Groceries'],
  // Dining
  ['food', '🍔 Dining & Takeaway'],
  ['foods', '🍔 Dining & Takeaway'],
  ['dining', '🍔 Dining & Takeaway'],
  ['food and dining', '🍔 Dining & Takeaway'],
  ['restaurant', '🍔 Dining & Takeaway'],
  ['restaurants', '🍔 Dining & Takeaway'],
  ['eat out', '🍔 Dining & Takeaway'],
  ['takeaway', '🍔 Dining & Takeaway'],
  // Coffee
  ['coffee', '☕ Coffee & Quick Food'],
  ['coffee shop', '☕ Coffee & Quick Food'],
  ['cafe', '☕ Coffee & Quick Food'],
  // Transport
  ['transport', '🚗 Transportation'],
  ['transportation', '🚗 Transportation'],
  ['transportation and fuel', '🚗 Transportation'],
  // Telecom
  ['telecom', '📱 Telecom & Subscriptions'],
  ['phone', '📱 Telecom & Subscriptions'],
  ['mobile', '📱 Telecom & Subscriptions'],
  ['internet', '📱 Telecom & Subscriptions'],
  ['subscriptions', '📱 Telecom & Subscriptions'],
  // Health
  ['medical', '🩺 Health & Medical'],
  ['health', '🩺 Health & Medical'],
  ['health fitness', '🩺 Health & Medical'],
  ['medical expenses', '🩺 Health & Medical'],
  ['pharmacy', '🩺 Health & Medical'],
  // Personal & Clothing
  ['wardrobe', '👕 Personal & Clothing'],
  ['clothing', '👕 Personal & Clothing'],
  ['clothes', '👕 Personal & Clothing'],
  ['shopping', '👕 Personal & Clothing'],
  ['grooming', '👕 Personal & Clothing'],
  ['personal care', '👕 Personal & Clothing'],
  ['barber', '👕 Personal & Clothing'],
  ['barbershop', '👕 Personal & Clothing'],
  // Entertainment
  ['entertainment', '🎬 Entertainment'],
  // Social
  ['social', '👥 Social'],
  ['socializing', '👥 Social'],
  // Family & Gifts
  ['family', '👨‍👩‍👦 Family & Gifts'],
  ['family expenses', '👨‍👩‍👦 Family & Gifts'],
  ['gift', '👨‍👩‍👦 Family & Gifts'],
  ['gifts', '👨‍👩‍👦 Family & Gifts'],
  // Education
  ['education', '📚 Education & Development'],
  // Debt
  ['debt repayment', '💳 Debt & Obligations'],
  ['repayment', '💳 Debt & Obligations'],
  ['loan', '💳 Debt & Obligations'],
  ['debt', '💳 Debt & Obligations'],
  // Savings
  ['savings', '💰 Savings & Goals'],
  ['savings and goals', '💰 Savings & Goals'],
  // Income
  ['salary', '📥 Income'],
  ['income', '📥 Income'],
  ['income salary', '📥 Income'],
  ['refund', '📥 Income'],
  ['other income', '📥 Income'],
  ['loan received', '🤝 Loan Received'],
  // Transfer
  ['transfer', '🔄 Transfer'],
  // Reimbursement
  ['reimbursement', '🔙 Reimbursement'],
]);

/**
 * Returns a fixed category label for new writes and analytics. Legacy values that do not
 * have a safe equivalent remain unchanged, so historic transaction rows are never lost.
 */
export const normalizeCategory = (category?: string | null) => {
  const trimmedCategory = category?.trim().replace(/\s+/g, ' ') ?? '';
  if (!trimmedCategory) return '';

  const key = categoryKey(trimmedCategory);
  return canonicalByKey.get(key) ?? aliases.get(key) ?? trimmedCategory;
};
