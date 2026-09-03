const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/SettingsTab.tsx', 'utf8');

code = code.replace(
  "interface SettingsTabProps {",
  "interface SettingsTabProps {\n  userSettings: any;"
);

code = code.replace(
  "export const SettingsTab: React.FC<SettingsTabProps> = ({",
  "export const SettingsTab: React.FC<SettingsTabProps> = ({\n  userSettings,"
);

fs.writeFileSync('src/components/dashboard/SettingsTab.tsx', code);
