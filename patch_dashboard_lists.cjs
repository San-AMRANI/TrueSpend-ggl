const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// For transactions
code = code.replace(
  /className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"/g,
  'className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0"'
);

// We need to make sure the right side aligns on mobile (e.g. justify-between or items-end on mobile)
// Let's modify the amount/button section of transaction:
code = code.replace(
  /<div className="flex items-center gap-4">/g,
  '<div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0">'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched Dashboard.tsx lists');
