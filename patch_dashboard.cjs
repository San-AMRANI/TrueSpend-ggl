const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const tabReplacement = `      <div className="flex items-center justify-between border-b border-gray-200 pb-px">
        <div className="flex space-x-2">
          <button onClick={() => setActiveTab('overview')} className={\`px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'overview' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Overview</button>
          <button onClick={() => setActiveTab('transactions')} className={\`px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'transactions' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Transactions</button>
          <button onClick={() => setActiveTab('debts')} className={\`px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'debts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Debts & Splits</button>
          <button onClick={() => setActiveTab('analytics')} className={\`px-4 py-2 text-sm font-medium transition-colors \${activeTab === 'analytics' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Analytics</button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mb-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={async () => {
            if (confirm('Are you sure you want to truncate the database and seed the shared data?')) {
              setLoading(true);
              try {
                const res = await fetch('/api/seed', {
                  method: 'POST',
                  headers: { 'Authorization': \`Bearer \${token}\` }
                });
                if (res.ok) {
                  await fetchData();
                } else {
                  alert('Failed to seed data');
                }
              } catch (e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Truncate & Seed Shared Data
        </Button>
      </div>`;

// Find the start of the tab navigation
const startIdx = code.indexOf('<div className="flex space-x-2 border-b border-gray-200 pb-px">');
const endIdx = code.indexOf('</div>', startIdx) + 6;

if (startIdx !== -1) {
  code = code.substring(0, startIdx) + tabReplacement + code.substring(endIdx);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Patched Dashboard.tsx with seed button');
} else {
  console.log('Failed to find tab navigation in Dashboard.tsx');
}
