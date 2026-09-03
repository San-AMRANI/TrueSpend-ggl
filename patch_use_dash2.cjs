const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

const effect = `
  useEffect(() => {
    if (!kpis) return;
    const settings = (kpis as any).settings;
    if (settings && settings.automatedDriveBackups) {
      const lastBackup = settings.lastDriveBackupDate ? new Date(settings.lastDriveBackupDate).getTime() : 0;
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (now - lastBackup > SEVEN_DAYS_MS) {
        handleBackupToDrive();
      }
    }
  }, [kpis]);
`;

code = code.replace(
  "useEffect(() => {\n    fetchData();\n  }, [fetchData]);",
  "useEffect(() => {\n    fetchData();\n  }, [fetchData]);\n" + effect
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
