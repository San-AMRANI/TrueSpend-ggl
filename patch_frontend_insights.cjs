const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/InsightsTab.tsx', 'utf8');

code = code.replace(
  /<div>\s*<p className="font-semibold text-gray-900 dark:text-white">{formatMAD\(a.amount\)} in {a.category}<\/p>\s*<p className="text-xs text-gray-600 dark:text-gray-400">{new Date\(a.date\).toLocaleDateString\(\)} • {a.notes}<\/p>\s*<\/div>\s*<\/div>/,
  `<div>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatMAD(a.amount)} in {a.category}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(a.date).toLocaleDateString()} • {a.notes}</p>
                    </div>
                    {a.confidence !== undefined && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300">
                        {a.confidence}% confidence
                      </span>
                    )}
                  </div>`
);

code = code.replace(
  /<div className="text-right">\s*<p className="font-bold text-gray-900 dark:text-white">{formatMAD\(s.amount\)}\/{s.frequency === 'monthly' \? 'mo' : 'wk'}<\/p>\s*<p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{formatMAD\(s.annualCost\)}\/yr<\/p>\s*<\/div>/,
  `<div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white flex items-center justify-end gap-2">
                      {formatMAD(s.amount)}/{s.frequency === 'monthly' ? 'mo' : 'wk'}
                    </p>
                    <p className="text-xs flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">{formatMAD(s.annualCost)}/yr</span>
                      {s.confidence !== undefined && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">{s.confidence}% sure</span>
                      )}
                    </p>
                  </div>`
);

fs.writeFileSync('src/components/dashboard/InsightsTab.tsx', code);
