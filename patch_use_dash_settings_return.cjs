const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "    insights,\n    emergencyBuffer,",
  "    insights,\n    userSettings,\n    emergencyBuffer,"
);

// also fix the useEffect dependency
code = code.replace(
  "  }, [kpis]);",
  "  }, [userSettings]);"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
