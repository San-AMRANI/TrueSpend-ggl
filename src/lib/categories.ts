export const expenseCategories = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Housing & Rent',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Health & Fitness',
  'Personal Care',
  'Debt Repayment',
  'Other',
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
  ['rent', 'Housing & Rent'],
  ['housing', 'Housing & Rent'],
  ['bills', 'Utilities'],
  ['health', 'Health & Fitness'],
  ['personal', 'Personal Care'],
  ['other expense', 'Other'],
  ['salary', 'Income'],
  ['income salary', 'Income'],
  ['repayment', 'Debt Repayment'],
]);

/**
 * Returns a consistent category label for grouping and future database writes.
 * Unknown custom categories are kept (trimmed) instead of losing user data.
 */
export const normalizeCategory = (category?: string | null) => {
  const trimmedCategory = category?.trim().replace(/\s+/g, ' ') ?? '';
  if (!trimmedCategory) return '';

  const key = categoryKey(trimmedCategory);
  return canonicalByKey.get(key) ?? aliases.get(key) ?? trimmedCategory;
};
