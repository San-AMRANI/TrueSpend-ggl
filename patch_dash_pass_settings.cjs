const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  "    insights,",
  "    insights,\n    userSettings,"
);

code = code.replace(
  "<SettingsTab",
  "<SettingsTab\n          userSettings={userSettings}"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
