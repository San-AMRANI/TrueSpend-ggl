import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { fireRepository } from '../repositories/FireRepository.js';

export class FireController {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const profile = await fireRepository.findByUserId(req.dbUser.id);
      if (!profile) {
        return res.json({
          currentAge: 28,
          targetAge: 55,
          expectedReturn: 7.5,
          safeWithdrawalRate: 4.0,
          monthlySavingsBoost: 0,
          expenseTrimPercent: 0,
          customMonthlyExpense: null,
        });
      }

      res.json({
        id: profile.id,
        userId: profile.userId,
        currentAge: Number(profile.currentAge),
        targetAge: Number(profile.targetAge),
        expectedReturn: Number(profile.expectedReturn),
        safeWithdrawalRate: Number(profile.safeWithdrawalRate),
        monthlySavingsBoost: Number(profile.monthlySavingsBoost),
        expenseTrimPercent: Number(profile.expenseTrimPercent),
        customMonthlyExpense: profile.customMonthlyExpense !== null ? Number(profile.customMonthlyExpense) : null,
        updatedAt: profile.updatedAt,
      });
    } catch (e) {
      console.error('Error fetching FIRE profile:', e);
      res.status(500).json({ error: 'Failed to fetch FIRE profile' });
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const {
        currentAge,
        targetAge,
        expectedReturn,
        safeWithdrawalRate,
        monthlySavingsBoost,
        expenseTrimPercent,
        customMonthlyExpense,
      } = req.body;

      const updated = await fireRepository.upsert(req.dbUser.id, {
        currentAge: currentAge !== undefined ? Number(currentAge) : undefined,
        targetAge: targetAge !== undefined ? Number(targetAge) : undefined,
        expectedReturn: expectedReturn !== undefined ? Number(expectedReturn) : undefined,
        safeWithdrawalRate: safeWithdrawalRate !== undefined ? Number(safeWithdrawalRate) : undefined,
        monthlySavingsBoost: monthlySavingsBoost !== undefined ? Number(monthlySavingsBoost) : undefined,
        expenseTrimPercent: expenseTrimPercent !== undefined ? Number(expenseTrimPercent) : undefined,
        customMonthlyExpense: customMonthlyExpense !== undefined ? (customMonthlyExpense === null ? null : Number(customMonthlyExpense)) : undefined,
      });

      res.json({
        id: updated.id,
        userId: updated.userId,
        currentAge: Number(updated.currentAge),
        targetAge: Number(updated.targetAge),
        expectedReturn: Number(updated.expectedReturn),
        safeWithdrawalRate: Number(updated.safeWithdrawalRate),
        monthlySavingsBoost: Number(updated.monthlySavingsBoost),
        expenseTrimPercent: Number(updated.expenseTrimPercent),
        customMonthlyExpense: updated.customMonthlyExpense !== null ? Number(updated.customMonthlyExpense) : null,
        updatedAt: updated.updatedAt,
      });
    } catch (e) {
      console.error('Error updating FIRE profile:', e);
      res.status(500).json({ error: 'Failed to update FIRE profile' });
    }
  }
}

export const fireController = new FireController();
