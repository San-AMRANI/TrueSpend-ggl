const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/SettingsTab.tsx', 'utf8');

// Add imports
code = code.replace(
  "import { Settings, User, Bell, Shield, Database, Send, Download, Upload } from 'lucide-react';",
  "import { Settings, User, Bell, Shield, Database, Send, Download, Upload, Cloud } from 'lucide-react';\nimport { googleSignIn, getGoogleAccessToken, googleLogout } from '../../lib/googleAuth';\nimport { uploadToGoogleDrive } from '../../lib/driveUpload';\nimport { dashboardService } from '../../services/api/dashboardService';\nimport { useAuth } from '../../context/AuthContext';"
);

// Add state for Google Drive inside SettingsTab
code = code.replace(
  "const [salary, setSalary] = useState(userSettings?.salary?.toString() || '');",
  "const [salary, setSalary] = useState(userSettings?.salary?.toString() || '');\n  const [isDriveConnecting, setIsDriveConnecting] = useState(false);\n  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);\n  const { token } = useAuth();"
);

// Add handlers
code = code.replace(
  "const handleSaveProfile = async () => {",
  `const handleConnectDrive = async () => {
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

  const handleSaveProfile = async () => {`
);

// Insert UI
const ui = `      {/* ── Google Drive Backups ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Google Drive Automated Backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Weekly Cloud Backups</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Automatically backup your PostgreSQL database to your Google Drive every week. 
                Requires signing in with your Google account.
              </p>
            </div>
            
            <div className="flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Automated Backups</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userSettings?.lastDriveBackupDate ? \`Last backup: \${new Date(userSettings.lastDriveBackupDate).toLocaleDateString()}\` : 'No backups yet.'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!userSettings?.automatedDriveBackups) {
                    handleConnectDrive();
                  } else {
                    handleSaveSettings({ automatedDriveBackups: false });
                  }
                }}
                className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 \${
                  userSettings?.automatedDriveBackups ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }\`}
                role="switch"
                aria-checked={userSettings?.automatedDriveBackups || false}
              >
                <span
                  className={\`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform \${
                    userSettings?.automatedDriveBackups ? 'translate-x-6' : 'translate-x-1'
                  }\`}
                />
              </button>
            </div>

            {userSettings?.automatedDriveBackups && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  disabled={isDriveBackingUp}
                  onClick={handleBackupToDrive}
                  className="flex items-center gap-2"
                >
                  <Cloud className="h-4 w-4 text-blue-600" />
                  {isDriveBackingUp ? 'Uploading to Drive...' : 'Backup to Drive Now'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* ── Data Backup ── */}`;

code = code.replace("{/* ── Data Backup ── */}", ui);

fs.writeFileSync('src/components/dashboard/SettingsTab.tsx', code);
