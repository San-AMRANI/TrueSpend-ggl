const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

const importStr = "import { googleSignIn, getGoogleAccessToken } from '../lib/googleAuth';\nimport { uploadToGoogleDrive } from '../lib/driveUpload';\n";
code = importStr + code;

const backupFn = `
  const handleBackupToDrive = async () => {
    try {
      let accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        return; // Don't prompt login automatically
      }
      
      const blob = await dashboardService.getSqlBlob(token);
      const filename = \\\`truespend_backup_\\\${new Date().toISOString().slice(0, 10)}.sql\\\`;
      await uploadToGoogleDrive(accessToken, blob, filename);
      
      await handleSaveSettings({ lastDriveBackupDate: new Date().toISOString() });
      console.log('Automated weekly backup to Google Drive completed.');
    } catch (e) {
      console.error('Automated backup failed:', e);
    }
  };
`;

code = code.replace(
  "const handleExportSql = async () => {",
  backupFn + "\n  const handleExportSql = async () => {"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
