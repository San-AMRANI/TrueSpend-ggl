const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "const filename = \\`truespend_backup_\\${new Date().toISOString().slice(0, 10)}.sql\\`;",
  "const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
