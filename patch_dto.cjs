const fs = require('fs');
let code = fs.readFileSync('server/services/SettingsService.ts', 'utf8');

code = code.replace(
  "export interface UpdateSettingsDTO {",
  "export interface UpdateSettingsDTO {\n  automatedDriveBackups?: boolean;\n  lastDriveBackupDate?: string;"
);

fs.writeFileSync('server/services/SettingsService.ts', code);
