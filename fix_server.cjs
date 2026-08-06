const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/\\n  \/\/ Vite middleware for development/, '\n  // Vite middleware for development');

fs.writeFileSync('server.ts', code);
console.log('Fixed server.ts');
