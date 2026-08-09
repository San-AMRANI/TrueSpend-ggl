export const expenseCategories = [
  'Debt Repayment',
  'Medical',
  'Wardrobe',
  'Social',
  'Groceries',
  'Food & Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Family',
  'Coffee',
  'Grooming',
  'Telecom',
] as const;

export const incomeAndTransferCategories = [
  'Income',
  'Transfer',
  'Reimbursement',
  'Refund',
  'Other Income',
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
  ['food', 'Food & Dining'],
  ['foods', 'Food & Dining'],
  ['dining', 'Food & Dining'],
  ['restaurant', 'Food & Dining'],
  ['restaurants', 'Food & Dining'],
  ['eat out', 'Food & Dining'],
  ['transport', 'Transportation'],
  ['transportation and fuel', 'Transportation'],
  ['rent', 'Utilities'],
  ['housing', 'Utilities'],
  ['housing rent', 'Utilities'],
  ['housing and rent', 'Utilities'],
  ['bills', 'Utilities'],
  ['health fitness', 'Medical'],
  ['medical expenses', 'Medical'],
  ['shopping', 'Wardrobe'],
  ['clothing', 'Wardrobe'],
  ['clothes', 'Wardrobe'],
  ['personal care', 'Grooming'],
  ['socializing', 'Social'],
  ['family expenses', 'Family'],
  ['coffee shop', 'Coffee'],
  ['barber', 'Grooming'],
  ['barbershop', 'Grooming'],
  ['phone', 'Telecom'],
  ['mobile', 'Telecom'],
  ['internet', 'Telecom'],
  ['salary', 'Income'],
  ['income salary', 'Income'],
  ['repayment', 'Debt Repayment'],
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
