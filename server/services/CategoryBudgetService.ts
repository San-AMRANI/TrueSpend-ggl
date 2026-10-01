import { normalizeCategory } from '../../src/lib/categories.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';

export interface UpsertCategoryBudgetDTO {
  category: string;
  year: number;
  month: number;
  amount: number;
}

export class CategoryBudgetService {
  async getBudgetsForUser(userId: string) {
    return categoryBudgetRepository.findAllByUserId(userId);
  }

  async upsertBudget(userId: string, dto: UpsertCategoryBudgetDTO) {
    const category = normalizeCategory(dto.category);
    if (!category) throw new Error('A category is required');
    if (!Number.isInteger(dto.year) || dto.year < 2000 || dto.year > 2200) throw new Error('Invalid budget year');
    if (!Number.isInteger(dto.month) || dto.month < 1 || dto.month > 12) throw new Error('Invalid budget month');
    if (!Number.isFinite(dto.amount) || dto.amount < 0) throw new Error('Budget amount must be zero or greater');

    return categoryBudgetRepository.upsert({
      userId,
      category,
      year: dto.year,
      month: dto.month,
      amount: String(dto.amount),
    });
  }

  async copyPreviousMonth(userId: string, year: number, month: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Invalid budget month');
    }
    const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const [previousBudgets, currentBudgets] = await Promise.all([
      categoryBudgetRepository.findByMonth(userId, previous.year, previous.month),
      categoryBudgetRepository.findByMonth(userId, year, month),
    ]);
    const currentCategories = new Set(currentBudgets.map((budget) => budget.category));
    const copied = [];
    for (const budget of previousBudgets) {
      if (!currentCategories.has(budget.category)) {
        copied.push(await categoryBudgetRepository.upsert({
          userId,
          category: budget.category,
          year,
          month,
          amount: String(budget.amount),
        }));
      }
    }
    return { copied: copied.length };
  }

  async deleteBudget(userId: string, id: string) {
    const deleted = await categoryBudgetRepository.deleteById(id, userId);
    if (!deleted) throw new Error('Budget not found or not owned by user');
    return deleted;
  }

  async batchUpsertBudgets(userId: string, budgets: { category: string; year: number; month: number; amount: number }[]) {
    if (!Array.isArray(budgets)) throw new Error('Budgets must be an array');
    
    const validBudgets = budgets.map((b) => {
      if (!b.category || typeof b.category !== 'string') throw new Error('Invalid category in batch');
      if (!Number.isInteger(b.year) || !Number.isInteger(b.month) || b.month < 1 || b.month > 12) {
        throw new Error(`Invalid year/month for category ${b.category}`);
      }
      if (typeof b.amount !== 'number' || b.amount < 0) {
        throw new Error(`Invalid amount for category ${b.category}`);
      }
      return {
        ...b,
        amount: String(b.amount),
      };
    });

    if (validBudgets.length === 0) return [];
    return categoryBudgetRepository.batchUpsert(userId, validBudgets);
  }

  async clearMonthBudgets(userId: string, year: number, month: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Invalid budget month');
    }
    return categoryBudgetRepository.deleteAllByMonth(userId, year, month);
  }
}

export const categoryBudgetService = new CategoryBudgetService();
