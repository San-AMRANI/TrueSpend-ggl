import { impulseRepository, CreateImpulseParams } from '../repositories/ImpulseRepository.js';
import { goalService } from './GoalService.js';
import { transactionService } from './TransactionService.js';
import { userRepository } from '../repositories/UserRepository.js';

export interface CreateImpulseDTO {
  name: string;
  amount: number;
  currency?: string;
  category?: string;
  notes?: string;
  url?: string;
  triggers?: string[];
  urgencyScore?: number;
  utilityScore?: number;
  coolingHours?: number;
}

export interface UpdateImpulseDTO {
  name?: string;
  amount?: number;
  currency?: string;
  category?: string;
  notes?: string;
  url?: string;
  triggers?: string[];
  urgencyScore?: number;
  utilityScore?: number;
  coolingHours?: number;
  status?: 'cooling' | 'resisted' | 'purchased' | 'dismissed';
  decisionNotes?: string;
}

export interface ResolveImpulseDTO {
  decision: 'resisted' | 'purchased' | 'dismissed';
  notes?: string;
  goalId?: string;
  walletId?: string;
}

export class ImpulseService {
  async getItemsForUser(userId: string) {
    const items = await impulseRepository.findAllByUserId(userId);
    return items.map((item) => ({
      ...item,
      triggers: this.parseTriggers(item.triggers),
    }));
  }

  async getItemById(id: string, userId: string) {
    const item = await impulseRepository.findByIdAndUserId(id, userId);
    if (!item) return null;
    return {
      ...item,
      triggers: this.parseTriggers(item.triggers),
    };
  }

  async createItem(userId: string, dto: CreateImpulseDTO) {
    const name = dto.name?.trim();
    if (!name) throw new Error('Item name is required');
    const amountNum = Number(dto.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const coolingHours = Number(dto.coolingHours) || 72;
    const coolsAt = new Date(Date.now() + coolingHours * 60 * 60 * 1000);

    const created = await impulseRepository.create({
      userId,
      name,
      amount: amountNum.toFixed(2),
      currency: dto.currency || 'MAD',
      category: dto.category || 'Shopping & Gadgets',
      notes: dto.notes?.trim() || null,
      url: dto.url?.trim() || null,
      triggers: JSON.stringify(Array.isArray(dto.triggers) ? dto.triggers : []),
      urgencyScore: Math.min(10, Math.max(1, Number(dto.urgencyScore) || 5)),
      utilityScore: Math.min(10, Math.max(1, Number(dto.utilityScore) || 5)),
      coolingHours,
      coolsAt,
      status: 'cooling',
    });

    return {
      ...created,
      triggers: this.parseTriggers(created.triggers),
    };
  }

  async updateItem(userId: string, id: string, dto: UpdateImpulseDTO) {
    const existing = await impulseRepository.findByIdAndUserId(id, userId);
    if (!existing) throw new Error('Impulse item not found');

    const updateData: Partial<CreateImpulseParams> = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.amount !== undefined) {
      const amt = Number(dto.amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be positive');
      updateData.amount = amt.toFixed(2);
    }
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.notes !== undefined) updateData.notes = dto.notes?.trim() || null;
    if (dto.url !== undefined) updateData.url = dto.url?.trim() || null;
    if (dto.triggers !== undefined) updateData.triggers = JSON.stringify(dto.triggers);
    if (dto.urgencyScore !== undefined) updateData.urgencyScore = Math.min(10, Math.max(1, Number(dto.urgencyScore)));
    if (dto.utilityScore !== undefined) updateData.utilityScore = Math.min(10, Math.max(1, Number(dto.utilityScore)));
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.decisionNotes !== undefined) updateData.decisionNotes = dto.decisionNotes;

    const updated = await impulseRepository.update(id, userId, updateData);
    if (!updated) throw new Error('Failed to update impulse item');

    return {
      ...updated,
      triggers: this.parseTriggers(updated.triggers),
    };
  }

  async deleteItem(userId: string, id: string) {
    const existing = await impulseRepository.findByIdAndUserId(id, userId);
    if (!existing) throw new Error('Impulse item not found');
    await impulseRepository.deleteByIdAndUserId(id, userId);
    return { success: true };
  }

  async resolveDecision(userId: string, id: string, dto: ResolveImpulseDTO) {
    const item = await impulseRepository.findByIdAndUserId(id, userId);
    if (!item) throw new Error('Impulse item not found');

    const decision = dto.decision;
    const decisionNotes = dto.notes?.trim() || null;
    const now = new Date();
    const itemAmount = parseFloat(item.amount);

    let savedToGoalId: string | null = null;
    let walletId: string | null = dto.walletId || null;

    if (decision === 'resisted') {
      if (dto.goalId) {
        await goalService.contributeToGoal(dto.goalId, userId, {
          amount: itemAmount,
          walletId: dto.walletId || undefined,
          note: `Impulse Shield Victory: Resisted buying "${item.name}"!`,
          date: now.toISOString().slice(0, 10),
        });
        savedToGoalId = dto.goalId;
      }
    } else if (decision === 'purchased') {
      await transactionService.createTransaction(userId, {
        amount: itemAmount,
        type: 'Expense',
        category: item.category || 'Shopping & Gadgets',
        notes: `Conscious Purchase (Impulse Shield): ${item.name}`,
        walletId: walletId || null,
        transaction_date: now.toISOString().slice(0, 10),
      });
    }

    const updated = await impulseRepository.update(id, userId, {
      status: decision,
      decisionDate: now,
      decisionNotes,
      savedToGoalId,
      walletId,
    });

    return {
      ...updated,
      triggers: this.parseTriggers(updated?.triggers || '[]'),
    };
  }

  async getStats(userId: string) {
    const items = await impulseRepository.findAllByUserId(userId);
    const user = await userRepository.findById(userId);

    const salary = user?.salary ? parseFloat(String(user.salary)) : 0;
    const hourlyRate = salary > 0 ? salary / 176 : 50;

    let totalCoolingCount = 0;
    let totalCoolingAmount = 0;
    let totalResistedCount = 0;
    let totalResistedAmount = 0;
    let totalPurchasedCount = 0;
    let totalPurchasedAmount = 0;

    const triggerCounts: Record<string, number> = {};

    for (const item of items) {
      const amt = parseFloat(item.amount) || 0;
      const triggers = this.parseTriggers(item.triggers);
      triggers.forEach((t) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });

      if (item.status === 'cooling') {
        totalCoolingCount++;
        totalCoolingAmount += amt;
      } else if (item.status === 'resisted') {
        totalResistedCount++;
        totalResistedAmount += amt;
      } else if (item.status === 'purchased') {
        totalPurchasedCount++;
        totalPurchasedAmount += amt;
      }
    }

    const decidedCount = totalResistedCount + totalPurchasedCount;
    const resistanceRate = decidedCount > 0 ? Math.round((totalResistedCount / decidedCount) * 100) : 100;
    const totalReclaimedHours = Math.round((totalResistedAmount / hourlyRate) * 10) / 10;

    const totalTriggerEntries = Object.values(triggerCounts).reduce((a, b) => a + b, 0);
    const triggerBreakdown = Object.entries(triggerCounts)
      .map(([trigger, count]) => ({
        trigger,
        count,
        percentage: totalTriggerEntries > 0 ? Math.round((count / totalTriggerEntries) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCoolingCount,
      totalCoolingAmount: Math.round(totalCoolingAmount * 100) / 100,
      totalResistedCount,
      totalResistedAmount: Math.round(totalResistedAmount * 100) / 100,
      totalPurchasedCount,
      totalPurchasedAmount: Math.round(totalPurchasedAmount * 100) / 100,
      totalReclaimedHours,
      resistanceRate,
      triggerBreakdown,
    };
  }

  private parseTriggers(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const impulseService = new ImpulseService();
