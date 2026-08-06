const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const settingsIndex = code.indexOf("{activeTab === 'settings' && (");
if (settingsIndex !== -1) {
  code = code.substring(0, settingsIndex);
  code += `{activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>New Month Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
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
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                 <h3 className="text-sm font-medium text-gray-900 mb-2">Past Data</h3>
                 <p className="text-sm text-gray-500">
                   All your past transaction data is automatically kept in your database. 
                   The KPIs on the Overview tab specifically track your current month's pacing.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
`;
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Fixed tail');
}
