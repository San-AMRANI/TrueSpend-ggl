const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace("import logoImg from './assets/logo-1.png';", "");
content = content.replace(/<img src=\{logoImg\}/g, '<img src="/logo-1.png" referrerPolicy="no-referrer"');
fs.writeFileSync('src/App.tsx', content);
