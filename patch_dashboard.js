import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  "setEmergencyBuffer,",
  "setEmergencyBuffer,\n    payrolls,\n    handleCreatePayroll,\n    handleDeletePayroll,"
);

code = code.replace(
  "<FinancialCalendarTab transactions={transactions} debts={debts} payday={payday} openTransaction={openTransaction} setActiveTab={setActiveTab} />",
  "<FinancialCalendarTab transactions={transactions} debts={debts} payday={payday} payrolls={payrolls} onCreatePayroll={handleCreatePayroll} onDeletePayroll={handleDeletePayroll} openTransaction={openTransaction} setActiveTab={setActiveTab} />"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
