import { payrollRepository } from '../repositories/PayrollRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const asCalendarDate = (value: string) => {
  if (!DATE_ONLY.test(value)) throw new Error('Invalid payroll date');
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid payroll date');
  }
  return parsed;
};

const monthBounds = (date: Date) => ({
  start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
});

export class PayrollService {
  getPayrollsForUser(userId: string) {
    return payrollRepository.findAllByUserId(userId);
  }

  async createPayroll(userId: string, dto: { scheduledFor?: string; amount?: number }) {
    if (!dto.scheduledFor) throw new Error('A payroll date is required');
    if (!Number.isFinite(dto.amount) || (dto.amount || 0) <= 0) throw new Error('Payroll amount must be greater than zero');

    const scheduledFor = asCalendarDate(dto.scheduledFor);
    const { start, end } = monthBounds(scheduledFor);
    const existingForMonth = await payrollRepository.findForMonth(userId, start, end);
    if (existingForMonth) throw new Error('This calendar month already has a payroll. Edit the existing entry in Transactions after it is posted.');

    return payrollRepository.create({ userId, scheduledFor, amount: String(dto.amount) });
  }

  async deletePayroll(userId: string, payrollId: string) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId);
    if (!payroll) throw new Error('Payroll not found');
    if (await transactionRepository.findByPayrollId(payrollId)) {
      throw new Error('This payroll has already been posted. Edit its transaction instead.');
    }
    await payrollRepository.deleteByIdAndUserId(payrollId, userId);
  }

  /** Safe to call from every data refresh; payroll_id is unique on transactions. */
  async reconcileDuePayrolls(userId: string, now = new Date()) {
    const payrolls = await payrollRepository.findAllByUserId(userId);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let posted = 0;

    for (const payroll of payrolls) {
      const payrollDay = new Date(payroll.scheduledFor);
      const calendarDay = new Date(payrollDay.getFullYear(), payrollDay.getMonth(), payrollDay.getDate()).getTime();
      if (calendarDay > today || await transactionRepository.findByPayrollId(payroll.id)) continue;

      await transactionRepository.create({
        userId,
        payrollId: payroll.id,
        amount: String(payroll.amount),
        type: 'Income',
        sourceWallet: 'Bank',
        category: '📥 Income',
        notes: 'Payroll deposited automatically',
        createdAt: payrollDay,
      });
      posted += 1;
    }

    return posted;
  }
}

export const payrollService = new PayrollService();
