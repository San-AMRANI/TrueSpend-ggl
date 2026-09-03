const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf8');

code = code.replace(/salary: decimal\('salary'\)\.default\('0'\)\.notNull\(\),/, "salary: decimal('salary').default('0').notNull(),\n  automatedDriveBackups: integer('automated_drive_backups').default(0),\n  lastDriveBackupDate: timestamp('last_drive_backup_date'),");

fs.writeFileSync('src/db/schema.ts', code);
