import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { goalContributionEvents } from '../../src/db/schema.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { transactionService } from './TransactionService.js';
import { walletRepository } from '../repositories/WalletRepository.js';

export interface CreateGoalDTO {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  walletId?: string | null;
  autoSyncBalance?: boolean;
  fundingCadence?: string;
  plannedContributionAmount?: number;
  deadline?: string | null;
  category?: string;
  notes?: string;
}

export interface UpdateGoalDTO {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  walletId?: string | null;
  autoSyncBalance?: boolean;
  fundingCadence?: string;
  plannedContributionAmount?: number;
  deadline?: string | null;
  category?: string;
  notes?: string;
}

export interface GoalContributionDTO {
  amount: number;
  walletId?: string;
  destinationWalletId?: string;
  note?: string;
  date?: string;
}

export class GoalService {
  async getGoalsForUser(userId: string) {
    const [goalList, events] = await Promise.all([
      goalRepository.findAllByUserId(userId),
      db.select().from(goalContributionEvents).where(eq(goalContributionEvents.userId, userId)),
    ]);

    return goalList.map((g) => {
      const goalEvents = events.filter((e) => e.goalId === g.id);
      const auditedNetContributions = goalEvents.reduce(
        (sum, e) =>
          sum +
          (e.eventType === 'withdrawal'
            ? -Number(e.amount || 0)
            : Number(e.amount || 0)),
        0
      );
      return {
        ...g,
        contributionEventsCount: goalEvents.length,
        auditedNetContributions: Number(auditedNetContributions.toFixed(2)),
        contributionHistory: goalEvents.slice(0, 20),
      };
    });
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
    const current = Math.max(0, Number(dto.currentAmount ?? 0));
    const deadline = dto.deadline ? new Date(dto.deadline) : null;

    let walletId = dto.walletId?.trim() || null;
    if (walletId) {
      const wallet = await walletRepository.findById(walletId, userId);
      if (!wallet) walletId = null;
    }

    const created = await goalRepository.create({
      userId,
      name,
      targetAmount: String(target),
      currentAmount: String(Number.isFinite(current) ? current : 0),
      walletId,
      autoSyncBalance: Boolean(dto.autoSyncBalance),
      deadline,
      category: dto.category?.trim() || 'General',
      notes: dto.notes?.trim() || '',
    });

    if (current > 0) {
      await db.insert(goalContributionEvents).values({
        userId,
        goalId: created.id,
        transactionId: null,
        sourceWalletId: walletId,
        destinationWalletId: walletId,
        eventType: 'reconciliation',
        amount: String(current),
        eventDate: new Date().toISOString().slice(0, 10),
        notes: 'Initial opening goal balance',
      });
    }

    return created;
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
    if (dto.walletId !== undefined) {
      const wId = dto.walletId?.trim() || null;
      if (wId) {
        const wallet = await walletRepository.findById(wId, userId);
        updateData.walletId = wallet ? wId : null;
      } else {
        updateData.walletId = null;
      }
    }
    if (dto.autoSyncBalance !== undefined) {
      updateData.autoSyncBalance = Boolean(dto.autoSyncBalance);
    }
    if (dto.fundingCadence !== undefined) {
      updateData.fundingCadence = dto.fundingCadence;
    }
    if (dto.plannedContributionAmount !== undefined) {
      updateData.plannedContributionAmount = String(Math.max(0, Number(dto.plannedContributionAmount || 0)));
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
    const targetWalletId = dto.destinationWalletId || goal.walletId;
    const eventDate = dto.date || new Date().toISOString().slice(0, 10);

    if (dto.walletId && targetWalletId && dto.walletId !== targetWalletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Transfer',
        walletId: dto.walletId,
        destinationWalletId: targetWalletId,
        category: '🛟 Emergency & goals Fund',
        notes: dto.note?.trim() || `Deposit to Goal: ${goal.name}`,
        transaction_date: eventDate,
      });
    } else if (dto.walletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Expense',
        walletId: dto.walletId,
        category: '🛟 Emergency & goals Fund',
        notes: dto.note?.trim() || `Contributed to goal: ${goal.name}`,
        transaction_date: eventDate,
      });
    }

    const newCurrent = (parseFloat(goal.currentAmount as string) || 0) + amount;
    const updated = await goalRepository.update(id, userId, {
      currentAmount: String(newCurrent),
    });

    await db.insert(goalContributionEvents).values({
      userId,
      goalId: id,
      transactionId: transaction?.id || null,
      sourceWalletId: dto.walletId || null,
      destinationWalletId: targetWalletId || null,
      eventType: 'contribution',
      amount: String(amount),
      eventDate,
      notes: dto.note?.trim() || `Contributed to ${goal.name}`,
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
    const sourceWalletId = goal.walletId;
    const eventDate = dto.date || new Date().toISOString().slice(0, 10);

    if (sourceWalletId && dto.walletId && sourceWalletId !== dto.walletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Transfer',
        walletId: sourceWalletId,
        destinationWalletId: dto.walletId,
        category: '🔄 Transfer',
        notes: dto.note?.trim() || `Withdrawal from Goal: ${goal.name}`,
        transaction_date: eventDate,
      });
    } else if (dto.walletId) {
      transaction = await transactionService.createTransaction(userId, {
        amount,
        type: 'Income',
        walletId: dto.walletId,
        category: '💰 Savings & Goals',
        notes: dto.note?.trim() || `Withdrawal from goal: ${goal.name}`,
        transaction_date: eventDate,
      });
    }

    const newCurrent = Math.max(0, current - amount);
    const updated = await goalRepository.update(id, userId, {
      currentAmount: String(newCurrent),
    });

    await db.insert(goalContributionEvents).values({
      userId,
      goalId: id,
      transactionId: transaction?.id || null,
      sourceWalletId: sourceWalletId || null,
      destinationWalletId: dto.walletId || null,
      eventType: 'withdrawal',
      amount: String(amount),
      eventDate,
      notes: dto.note?.trim() || `Withdrawal from ${goal.name}`,
    });

    return { goal: updated, transaction };
  }

  async reconcileGoalFromEvents(id: string, userId: string) {
    const goal = await goalRepository.findByIdAndUserId(id, userId);
    if (!goal) throw new Error('Goal not found');
    const events = await db
      .select()
      .from(goalContributionEvents)
      .where(and(eq(goalContributionEvents.goalId, id), eq(goalContributionEvents.userId, userId)));
    if (events.length === 0) return goal;

    const netTotal = Math.max(
      0,
      events.reduce(
        (sum, e) =>
          sum + (e.eventType === 'withdrawal' ? -Number(e.amount || 0) : Number(e.amount || 0)),
        0
      )
    );
    return await goalRepository.update(id, userId, {
      currentAmount: String(netTotal.toFixed(2)),
    });
  }

  async deleteGoal(id: string, userId: string) {
    const existing = await goalRepository.findByIdAndUserId(id, userId);
    if (!existing) throw new Error('Goal not found');
    await goalRepository.deleteByIdAndUserId(id, userId);
    return { success: true };
  }
}

export const goalService = new GoalService();

