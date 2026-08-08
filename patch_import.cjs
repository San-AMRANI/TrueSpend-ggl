const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes("import logoImg from ")) {
  content = content.replace(
    "import Dashboard from './components/Dashboard';",
    "import Dashboard from './components/Dashboard';\nimport logoImg from './assets/logo-1.png';"
  );
}

content = content.replace(
  /<img src="\/logo-1\.png"/g,
  '<img src={logoImg}'
);

fs.writeFileSync('src/App.tsx', content);

let html = fs.readFileSync('index.html', 'utf-8');
html = html.replace(
  /<link rel="icon" type="image\/png" href="[^"]*"/,
  '<link rel="icon" type="image/png" href="/src/assets/logo-1.png"'
);
fs.writeFileSync('index.html', html);
