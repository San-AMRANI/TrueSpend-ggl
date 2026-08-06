const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// 1. Add payday state and logic
if (!code.includes('const [payday, setPayday] = useState(25);')) {
  code = code.replace(
    "const [debts, setDebts] = useState<any[]>([]);",
    "const [debts, setDebts] = useState<any[]>([]);\n  const [payday, setPayday] = useState(25);\n  const [isSavingPayday, setIsSavingPayday] = useState(false);\n  const [analyticsMonth, setAnalyticsMonth] = useState('All Time');"
  );
}

// Update fetchData to also get settings
const oldFetchData = `      const txRes = await fetch('/api/transactions', { headers: { 'Authorization': \\\`Bearer \${token}\\\` } });
      const txData = await txRes.json();
      setTransactions(txData);

      const dRes = await fetch('/api/debts', { headers: { 'Authorization': \\\`Bearer \${token}\\\` } });
      const dData = await dRes.json();
      setDebts(dData);`;

const newFetchData = `      const txRes = await fetch('/api/transactions', { headers: { 'Authorization': \\\`Bearer \${token}\\\` } });
      const txData = await txRes.json();
      setTransactions(txData);

      const dRes = await fetch('/api/debts', { headers: { 'Authorization': \\\`Bearer \${token}\\\` } });
      const dData = await dRes.json();
      setDebts(dData);

      const sRes = await fetch('/api/settings', { headers: { 'Authorization': \\\`Bearer \${token}\\\` } });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.payday) setPayday(sData.payday);
      }`;

code = code.replace(oldFetchData, newFetchData);

// Update settings view
const oldSettings = `              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Start a New Month</h3>
                <p className="text-sm text-blue-600 mb-4">
                  The dashboard automatically rolls over your monthly spending limits on the 1st of every month. Your past transactions and debts are preserved in the "Transactions" and "Debts" tabs. 
                  You can log your new month's income here to start fresh.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                       setActiveTab('overview');
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Log New Salary / Income
                  </Button>
                </div>
              </div>`;

const newSettings = `              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Start a New Month</h3>
                <p className="text-sm text-blue-600 mb-4">
                  The dashboard automatically rolls over your monthly spending limits based on your defined payday. 
                  You can log your new month's income to start fresh.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Button 
                    variant="outline" 
                    className="border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                       setActiveTab('overview');
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Log New Salary / Income
                  </Button>
                </div>
                <hr className="border-blue-200 my-4" />
                <h3 className="text-sm font-medium text-blue-800 mb-2">Payroll Date (Payday)</h3>
                <p className="text-sm text-blue-600 mb-4">
                  Select the day of the month you usually get paid. This resets your monthly pacing KPIs.
                </p>
                <div className="flex items-center gap-3">
                  <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                    {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </Select>
                  <Button 
                    disabled={isSavingPayday}
                    onClick={async () => {
                      setIsSavingPayday(true);
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': \\\`Bearer \${token}\\\` },
                          body: JSON.stringify({ payday })
                        });
                        if (res.ok) {
                          await fetchData();
                          alert('Payday updated successfully!');
                        }
                      } catch(e) {
                        console.error(e);
                      } finally {
                        setIsSavingPayday(false);
                      }
                    }}
                  >
                    {isSavingPayday ? 'Saving...' : 'Save Payday'}
                  </Button>
                </div>
              </div>`;

code = code.replace(oldSettings, newSettings);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched dashboard fetch & settings.');
