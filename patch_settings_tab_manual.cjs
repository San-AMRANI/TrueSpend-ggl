const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/SettingsTab.tsx', 'utf8');

code = code.replace(
  "import { Bell, BellOff, Database, Download, Moon, Sun, Monitor, Upload, Send } from 'lucide-react';",
  "import { Bell, BellOff, Database, Download, Moon, Sun, Monitor, Upload, Send, Cloud } from 'lucide-react';\nimport { googleSignIn, getGoogleAccessToken } from '../../lib/googleAuth';\nimport { uploadToGoogleDrive } from '../../lib/driveUpload';\nimport { dashboardService } from '../../services/api/dashboardService';\nimport { useAuth } from '../../context/AuthContext';"
);

// We also need `isDriveConnecting`, `isDriveBackingUp`, etc. Let's see if they exist.
if (!code.includes("const [isDriveConnecting")) {
  code = code.replace(
    "const [notifToast, setNotifToast] = useState<string | null>(null);",
    "const [notifToast, setNotifToast] = useState<string | null>(null);\n  const [isDriveConnecting, setIsDriveConnecting] = useState(false);\n  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);\n  const { token } = useAuth();"
  );
  
  const handlers = `
  const handleConnectDrive = async () => {
    try {
      setIsDriveConnecting(true);
      const res = await googleSignIn();
      if (res) {
        await handleSaveSettings({ automatedDriveBackups: true });
        alert('Google Drive connected successfully!');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect Google Drive.');
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleBackupToDrive = async () => {
    try {
      setIsDriveBackingUp(true);
      let accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        const res = await googleSignIn();
        if (res) accessToken = res.accessToken;
      }
      if (!accessToken) throw new Error('No access token');
      
      const blob = await dashboardService.getSqlBlob(token);
      const filename = \`truespend_backup_\${new Date().toISOString().slice(0, 10)}.sql\`;
      await uploadToGoogleDrive(accessToken, blob, filename);
      
      await handleSaveSettings({ lastDriveBackupDate: new Date().toISOString() });
      alert('Backup saved to Google Drive successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to backup to Google Drive.');
    } finally {
      setIsDriveBackingUp(false);
    }
  };
  `;
  
  code = code.replace(
    "const showNotifToast = (msg: string) => {",
    handlers + "\n  const showNotifToast = (msg: string) => {"
  );
}

fs.writeFileSync('src/components/dashboard/SettingsTab.tsx', code);
