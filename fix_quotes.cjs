const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  /'Authorization': \\\`Bearer \${token}\\\`/g,
  "'Authorization': `Bearer ${token}`"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed quotes.');
