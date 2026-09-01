const fs = require('fs');

let code = fs.readFileSync('src/components/dashboard/GoalsTab.tsx', 'utf8');

const replaceGoalRender = `
                <div className="mt-4 mb-2 flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMAD(goal.currentAmount)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">of {formatMAD(goal.targetAmount)} target</p>
                  </div>
                  {!isCompleted && (
                    <button onClick={() => handleContribute(goal.id)} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-md transition-colors">
                      <TrendingUp className="h-4 w-4" />
                      Add Funds
                    </button>
                  )}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-3 overflow-hidden">
                  <div className={\`h-2.5 rounded-full transition-all duration-500 ease-out \${isCompleted ? 'bg-green-500' : 'bg-indigo-600 dark:bg-indigo-500'}\`} style={{ width: \`\${Math.min(100, Math.max(0, progress))}%\` }}></div>
                </div>
                
                {!isCompleted && goal.deadline && (() => {
                  const daysRemaining = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / 86_400_000));
                  const monthsRemaining = Math.max(1, daysRemaining / 30.44);
                  const remainingAmount = goal.targetAmount - goal.currentAmount;
                  const reqPerMonth = remainingAmount / monthsRemaining;
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Target: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                      <p className="text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                        Requires {formatMAD(reqPerMonth)} / month
                      </p>
                    </div>
                  );
                })()}
                
                {isCompleted && goal.deadline && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed ahead of {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                )}
                
                {!isCompleted && !goal.deadline && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No target date set
                  </p>
                )}
`;

code = code.replace(
  /<div className="mt-4 mb-2 flex justify-between items-end">[\s\S]*?<\/p>\s*\)}/m,
  replaceGoalRender
);

fs.writeFileSync('src/components/dashboard/GoalsTab.tsx', code);
