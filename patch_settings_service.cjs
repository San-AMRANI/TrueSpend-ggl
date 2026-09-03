const fs = require('fs');
let code = fs.readFileSync('server/services/SettingsService.ts', 'utf8');

code = code.replace(
  "const updateData: { payday?: number; emergencyBuffer?: string; salary?: string } = {};",
  "const updateData: { payday?: number; emergencyBuffer?: string; salary?: string; automatedDriveBackups?: number; lastDriveBackupDate?: Date } = {};"
);

code = code.replace(
  /if \(dto\.payday !== undefined\) \{/,
  "if (dto.automatedDriveBackups !== undefined) {\n      updateData.automatedDriveBackups = dto.automatedDriveBackups ? 1 : 0;\n    }\n    if (dto.lastDriveBackupDate !== undefined) {\n      updateData.lastDriveBackupDate = new Date(dto.lastDriveBackupDate);\n    }\n    if (dto.payday !== undefined) {"
);

fs.writeFileSync('server/services/SettingsService.ts', code);
