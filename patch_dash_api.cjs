const fs = require('fs');
let code = fs.readFileSync('src/services/api/dashboardService.ts', 'utf8');

code = code.replace(
  "updateSettings: (payload: { emergencyBuffer?: number }, token: string | null) =>",
  "updateSettings: (payload: { emergencyBuffer?: number; automatedDriveBackups?: boolean; lastDriveBackupDate?: string }, token: string | null) =>"
);

fs.writeFileSync('src/services/api/dashboardService.ts', code);
