const fs = require('fs');
const content = fs.readFileSync('server/services/KpiService.ts', 'utf8');

// replace KpiService
let newContent = content.replace(
  "import { transactionRepository } from '../repositories/TransactionRepository.js';",
  "import { transactionRepository } from '../repositories/TransactionRepository.js';\nimport { payrollService } from './PayrollService.js';"
);

fs.writeFileSync('server/services/KpiService.ts', newContent);
