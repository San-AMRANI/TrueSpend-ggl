import { goalRepository } from '../repositories/GoalRepository.js';
import { transactionService } from './TransactionService.js';

export interface CreateGoalDTO {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string | null;
  category?: string;
  notes?: string;
}

export interface UpdateGoalDTO {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string | null;
  category?: string;
  notes?: string;
}

export interface GoalContributionDTO {
  amount: number;
  walletId?: string;
  note?: string;
  date?: string;
}

export class GoalService {
  async getGoalsForUser(userId: string) {
    return await goalRepository.findAllByUserId(userId);
  }

  async getGoalById(id: string, userId: string) {
    const goal = await goalRepository.findByIdAndUserId(id, userId);
    if (!goal) throw new Error('Goal not found');
    return goal;
  }

  async createGoal(userId: string, dto: CreateGoalDTO) {
    const name = dto.name?.trim();
    if (!name) throw new Error('Goal name is required');
    const target = Number(dto.targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error('Target amount must be greater than zero');
    }
    const current = Number(dto.currentAmount ?? 0);
    const deadline = dto.deadline ? new Date(dto.deadline) : null;

    return await goalRepository.create({
      userId,
      name,
      targetAmount: String(target),
      currentAmount: String(Math.max(0, Number.isFinite(current) ? current : 0)),
      deadline,
      category: dto.category?.trim() || 'General',
      notes: dto.notes?.trim() || '',
    });
  }

  async updateGoal(id: string, userId: string, dto: UpdateGoalDTO) {
    const existing = await goalRepository.findByIdAndUserId(id, userId);
    if (!existing) throw new Error('Goal not found');

    const updateData: any = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new Error('Goal name cannot be empty');
      updateData.name = name;
    }
    if (dto.targetAmount !== undefined) {
      const target = Number(dto.targetAmount);
      if (!Number.isFinite(target) || target <= 0) {
        throw new Error('Target amount must be greater than zero');
      }
      updateData.targetAmount = String(target);
    }
    if (dto.currentAmount !== undefined) {
      const curr = Number(dto.currentAmount);
      if (!Number.isFinite(curr) || curr < 0) {
        throw new Error('Current amount cannot be negative');
      }
      updateData.currentAmount = String(curr);
    }
    if (dto.deadline !== undefined) {
      updateData.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category.trim();
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes.trim();
    }

    return await goalRepository.update(id, userId, updateData);
  }

  async contributeToGoal(id: string, userId: string, dto: GoalContributionDTO) {
    const goal = await goalRepository.findByIdAndUserId(id, userId);
    if (!goal) throw new Error('Goal not found');

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Contribution amount must be greater than zero');
    }

    let transaction = null;
    if (dto.walletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Expense',
        walletId: dto.walletId,
        category: '💰 Savings & Goals',
        notes: dto.note?.trim() || `Contributed to goal: ${goal.name}`,
        transaction_date: dto.date || new Date().toISOString().slice(0, 10),
      });
    }

    const newCurrent = (parseFloat(goal.currentAmount as string) || 0) + amount;
    const updated = await goalRepository.update(id, userId, {
      currentAmount: String(newCurrent),
    });

    return { goal: updated, transaction };
  }

  async withdrawFromGoal(id: string, userId: string, dto: GoalContributionDTO) {
    const goal = await goalRepository.findByIdAndUserId(id, userId);
    if (!goal) throw new Error('Goal not found');

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const current = parseFloat(goal.currentAmount as string) || 0;
    if (amount > current) {
      throw new Error(`Cannot withdraw ${amount} MAD; current saved amount is ${current} MAD`);
    }

    let transaction = null;
    if (dto.walletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Income',
        walletId: dto.walletId,
        category: '💰 Savings & Goals',
        notes: dto.note?.trim() || `Withdrawal from goal: ${goal.name}`,
        transaction_date: dto.date || new Date().toISOString().slice(0, 10),
      });
    }

    const newCurrent = Math.max(0, current - amount);
    const updated = await goalRepository.update(id, userId, {
      currentAmount: String(newCurrent),
    });

    return { goal: updated, transaction };
  }

  async deleteGoal(id: string, userId: string) {
    const existing = await goalRepository.findByIdAndUserId(id, userId);
    if (!existing) throw new Error('Goal not found');
    await goalRepository.deleteByIdAndUserId(id, userId);
    return { success: true };
  }
}

export const goalService = new GoalService();
