import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/SettingsTab.tsx', 'utf8');

const target = `            {/* Payroll */}
            <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Payroll Settings</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                Set your payroll date and expected salary to automatically deposit your salary into your bank account on payday.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Payday (Date)</label>
                  <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Monthly Salary Amount</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                    placeholder="Salary amount"
                  />
                </div>
              </div>
            </div>`;

code = code.replace(target, '');
fs.writeFileSync('src/components/dashboard/SettingsTab.tsx', code);
