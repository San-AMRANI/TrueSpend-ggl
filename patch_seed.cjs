const fs = require('fs');
let content = fs.readFileSync('src/db/seed_data.json', 'utf-8');

const mapping = {
  'Telecom': 'Utilities',
  'Social': 'Entertainment',
  'Adjustment': 'Other',
  'Transfer': 'Transfer',
  'Entertainment': 'Entertainment',
  'Utilities': 'Utilities',
  'Repayment': 'Debt Repayment',
  'Grooming': 'Personal Care',
  'Debt Repayment': 'Debt Repayment',
  'Reimbursement': 'Reimbursement',
  'Salary': 'Income',
  'Groceries': 'Groceries',
  'Food': 'Food & Dining',
  'Wardrobe': 'Shopping',
  'Coffee': 'Food & Dining',
  'Transport': 'Transportation',
  'Family': 'Other',
  'Gift': 'Other',
  'Medical': 'Health & Fitness'
};

Object.keys(mapping).forEach(key => {
  const regex = new RegExp('"category": "' + key + '"', 'g');
  content = content.replace(regex, '"category": "' + mapping[key] + '"');
});

fs.writeFileSync('src/db/seed_data.json', content);
