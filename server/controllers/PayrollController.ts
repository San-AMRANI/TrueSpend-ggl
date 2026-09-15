import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { payrollService } from '../services/PayrollService.js';

export class PayrollController {
  async getPayrolls(req: AuthRequest, res: Response) {
    try {
      res.json(await payrollService.getPayrollsForUser(req.dbUser.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createPayroll(req: AuthRequest, res: Response) {
    try {
      const payroll = await payrollService.createPayroll(req.dbUser.id, req.body);
      res.status(201).json(payroll);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Unable to create payroll' });
    }
  }

  async deletePayroll(req: AuthRequest, res: Response) {
    try {
      await payrollService.deletePayroll(req.dbUser.id, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(error?.message === 'Payroll not found' ? 404 : 400).json({ error: error?.message || 'Unable to delete payroll' });
    }
  }
}

export const payrollController = new PayrollController();
