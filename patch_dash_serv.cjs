const fs = require('fs');
let code = fs.readFileSync('src/services/api/dashboardService.ts', 'utf8');

code = code.replace(
  "exportSql: async (token: string | null) => {",
  "getSqlBlob: async (token: string | null) => {\n    const response = await fetch('/api/settings/export-sql', {\n      headers: token ? { Authorization: `Bearer ${token}` } : {},\n    });\n    if (!response.ok) {\n      throw new Error('Failed to download SQL export');\n    }\n    return await response.blob();\n  },\n  exportSql: async (token: string | null) => {"
);

fs.writeFileSync('src/services/api/dashboardService.ts', code);
