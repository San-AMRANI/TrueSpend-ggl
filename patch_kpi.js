import fs from 'fs';
let code = fs.readFileSync('server/services/KpiService.ts', 'utf8');

const target = `    let allTx = await transactionRepository.findAllByUserId(userId);
    
    const now = new Date();`;

const replacement = `    let allTx = await transactionRepository.findAllByUserId(userId);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Auto-deposit pending payrolls
    let shouldReloadTx = false;
    for (const p of payrolls) {
      if (p.isProcessed === 0) {
        const pDate = new Date(p.date);
        const pCalendarDay = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
        if (pCalendarDay <= today) {
          const tx = await transactionRepository.create({
            userId,
            amount: p.amount,
            type: 'Income',
            sourceWallet: 'Bank',
            category: 'Salary',
            notes: 'Auto-deposited payroll',
            createdAt: pDate,
          });
          const { payrollRepository } = await import('../repositories/PayrollRepository.js');
          await payrollRepository.markProcessed(p.id, tx.id);
          shouldReloadTx = true;
        }
      }
    }
    if (shouldReloadTx) {
      allTx = await transactionRepository.findAllByUserId(userId);
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/KpiService.ts', code);
