const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "const handleSaveSettings = async (newBuffer: number) => {",
  "const handleSaveSettings = async (payload: { emergencyBuffer?: number; automatedDriveBackups?: boolean; lastDriveBackupDate?: string }) => {"
);

code = code.replace(
  "await dashboardService.updateSettings({ emergencyBuffer: newBuffer }, token);",
  "await dashboardService.updateSettings(payload, token);"
);

// We need to fix where `handleSaveSettings(buffer)` is called in Dashboard.tsx
fs.writeFileSync('src/hooks/useDashboardData.ts', code);
