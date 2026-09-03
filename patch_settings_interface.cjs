const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/SettingsTab.tsx', 'utf8');

code = code.replace(
  "handleSaveSettings: (buffer: number) => void;",
  "handleSaveSettings: (payload: any) => Promise<void>;"
);

code = code.replace(
  "<Button disabled={isSaving} onClick={() => handleSaveSettings(emergencyBuffer)}>",
  "<Button disabled={isSaving} onClick={() => handleSaveSettings({ emergencyBuffer })}>"
);

fs.writeFileSync('src/components/dashboard/SettingsTab.tsx', code);
