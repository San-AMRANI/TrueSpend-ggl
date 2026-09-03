const fs = require('fs');
let code = fs.readFileSync('server/repositories/UserRepository.ts', 'utf8');

code = code.replace(
  "async updateSettings(userId: string, data: { payday?: number; emergencyBuffer?: string }) {",
  "async updateSettings(userId: string, data: any) {"
);

fs.writeFileSync('server/repositories/UserRepository.ts', code);
