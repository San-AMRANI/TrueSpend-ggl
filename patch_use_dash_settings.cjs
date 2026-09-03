const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "const [emergencyBuffer, setEmergencyBuffer] = useState<number>(0);",
  "const [emergencyBuffer, setEmergencyBuffer] = useState<number>(0);\n  const [userSettings, setUserSettings] = useState<any>(null);"
);

code = code.replace(
  "setEmergencyBuffer(settingsData?.emergencyBuffer ?? 0);",
  "setEmergencyBuffer(settingsData?.emergencyBuffer ?? 0);\n      setUserSettings(settingsData);"
);

code = code.replace(
  "const settings = (kpis as any).settings;",
  "const settings = userSettings;"
);

code = code.replace(
  "userSettings:",
  "// temp remove so it matches below"
);

code = code.replace(
  "emergencyBuffer,",
  "userSettings,\n    emergencyBuffer,"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
