import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { investmentService } from './InvestmentService.js';

export class NetWorthSnapshotService {
  async takeSnapshot(
    userId: string,
    liquidValue: number,
    investmentValue: number,
    debtValue: number,
  ) {
    const netWorth = liquidValue + investmentValue - debtValue;
    const today = new Date().toISOString().slice(0, 10);
    await investmentRepository.createNetWorthSnapshot({
      userId,
      date: today,
      liquidValue: String(Math.round(liquidValue * 100) / 100),
      investmentValue: String(Math.round(investmentValue * 100) / 100),
      debtValue: String(Math.round(debtValue * 100) / 100),
      netWorth: String(Math.round(netWorth * 100) / 100),
      currency: 'MAD',
    });
    return netWorth;
  }

  async getHistory(userId: string, period: '6m' | '1y' | 'all') {
    const days = period === '6m' ? 180 : period === '1y' ? 365 : 99999;
    return investmentRepository.getNetWorthHistory(userId, days);
  }
}

export const netWorthSnapshotService = new NetWorthSnapshotService();
