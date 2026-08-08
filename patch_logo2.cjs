const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /\/assets\/logo\/logo-1\.png/g,
  '/logo-1.png'
);

fs.writeFileSync('src/App.tsx', content);

let html = fs.readFileSync('index.html', 'utf-8');
html = html.replace(
  /\/assets\/logo\/logo-1\.png/g,
  '/logo-1.png'
);
fs.writeFileSync('index.html', html);
