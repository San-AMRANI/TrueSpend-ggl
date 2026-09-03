const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "  const [userSettings,\n    emergencyBuffer, setEmergencyBuffer] = useState<number>(0);\n  const [userSettings, setUserSettings] = useState<any>(null);",
  "  const [emergencyBuffer, setEmergencyBuffer] = useState<number>(0);\n  const [userSettings, setUserSettings] = useState<any>(null);"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
