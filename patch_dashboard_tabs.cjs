const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const tabReplacement = `      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-px gap-4 sm:gap-0">
        <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto scrollbar-hide pb-2 sm:pb-0">
          <button onClick={() => setActiveTab('overview')} className={\`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'overview' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Overview</button>
          <button onClick={() => setActiveTab('transactions')} className={\`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'transactions' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Transactions</button>
          <button onClick={() => setActiveTab('debts')} className={\`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'debts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Debts & Splits</button>
          <button onClick={() => setActiveTab('analytics')} className={\`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'analytics' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Analytics</button>
        </div>
        <Button `;

// Find the start of the tab navigation
const startIdx = code.indexOf('<div className="flex items-center justify-between border-b border-gray-200 pb-px">');
const endIdx = code.indexOf('<Button ', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + tabReplacement + code.substring(endIdx + 8);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Patched Dashboard.tsx tabs');
} else {
  console.log('Failed to find tab navigation in Dashboard.tsx');
}
