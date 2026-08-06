const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionForm.tsx', 'utf8');

code = code.replace(
  '<Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Groceries, Rent..." />',
  `<Select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="" disabled>Select category</option>
                <optgroup label="Expenses">
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Housing & Rent">Housing & Rent</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Health & Fitness">Health & Fitness</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Debt Repayment">Debt Repayment</option>
                  <option value="Other">Other Expense</option>
                </optgroup>
                <optgroup label="Income & Transfers">
                  <option value="Income">Income / Salary</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Reimbursement">Reimbursement</option>
                  <option value="Refund">Refund</option>
                  <option value="Other Income">Other Income</option>
                </optgroup>
              </Select>`
);

fs.writeFileSync('src/components/TransactionForm.tsx', code);
console.log('Patched TransactionForm.tsx');
