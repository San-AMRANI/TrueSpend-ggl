import { goalRepository } from '../repositories/GoalRepository.js';

export class GoalService {
  async getGoals(userId: string) {
    const rows = await goalRepository.findAllByUserId(userId);
    return rows.map((g) => ({
      id: g.id,
      userId: g.userId,
      name: g.name,
      targetAmount: parseFloat(g.targetAmount as unknown as string),
      currentAmount: parseFloat(g.currentAmount as unknown as string),
      deadline: g.deadline ? (g.deadline as Date).toISOString() : null,
      category: g.category ?? '',
      notes: g.notes ?? '',
      createdAt: (g.createdAt as Date).toISOString(),
      updatedAt: (g.updatedAt as Date).toISOString(),
    }));
  }

  async createGoal(userId: string, body: any) {
    const { name, targetAmount, currentAmount, deadline, category, notes } = body;
    if (!name || !targetAmount) throw new Error('name and targetAmount are required');
    const g = await goalRepository.create({
      userId,
      name: String(name),
      targetAmount: String(parseFloat(targetAmount)),
      currentAmount: currentAmount ? String(parseFloat(currentAmount)) : '0',
      deadline: deadline ? new Date(deadline) : null,
      category: category ?? '',
      notes: notes ?? '',
    });
    return {
      ...g,
      targetAmount: parseFloat(g.targetAmount as unknown as string),
      currentAmount: parseFloat(g.currentAmount as unknown as string),
      deadline: g.deadline ? (g.deadline as Date).toISOString() : null,
    };
  }

  async updateGoal(userId: string, goalId: string, body: any) {
    const patch: any = {};
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.targetAmount !== undefined) patch.targetAmount = String(parseFloat(body.targetAmount));
    if (body.currentAmount !== undefined) patch.currentAmount = String(parseFloat(body.currentAmount));
    if (body.deadline !== undefined) patch.deadline = body.deadline ? new Date(body.deadline) : null;
    if (body.category !== undefined) patch.category = String(body.category);
    if (body.notes !== undefined) patch.notes = String(body.notes);

    const g = await goalRepository.update(goalId, userId, patch);
    if (!g) throw new Error('Goal not found');
    return {
      ...g,
      targetAmount: parseFloat(g.targetAmount as unknown as string),
      currentAmount: parseFloat(g.currentAmount as unknown as string),
      deadline: g.deadline ? (g.deadline as Date).toISOString() : null,
    };
  }

  async deleteGoal(userId: string, goalId: string) {
    await goalRepository.delete(goalId, userId);
    return { deleted: true };
  }

  /** Add money to a goal's current amount */
  async contributeToGoal(userId: string, goalId: string, amount: number) {
    const existing = await goalRepository.findById(goalId, userId);
    if (!existing) throw new Error('Goal not found');
    const newAmount = Math.min(
      parseFloat(existing.targetAmount as unknown as string),
      parseFloat(existing.currentAmount as unknown as string) + amount,
    );
    return this.updateGoal(userId, goalId, { currentAmount: newAmount });
  }
}

export const goalService = new GoalService();
