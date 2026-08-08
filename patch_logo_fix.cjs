const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "import logoImg from './assets/logo-1.png';",
  ""
);

content = content.replace(
  /<img src=\{logoImg\} alt="TrueSpend Logo" className="mx-auto h-16 w-16" \/>/g,
  '<img src="/assets/logo/logo-1.png" alt="TrueSpend Logo" className="mx-auto h-16 w-16" referrerPolicy="no-referrer" />'
);

content = content.replace(
  /<img src=\{logoImg\} alt="TrueSpend Logo" className="h-8 w-8" \/>/g,
  '<img src="/assets/logo/logo-1.png" alt="TrueSpend Logo" className="h-8 w-8" referrerPolicy="no-referrer" />'
);

fs.writeFileSync('src/App.tsx', content);

let html = fs.readFileSync('index.html', 'utf-8');
if (!html.includes('referrerPolicy')) {
  html = html.replace(
    '<link rel="icon" type="image/png" href="/assets/logo/logo-1.png" />',
    '<link rel="icon" type="image/png" href="/assets/logo/logo-1.png" referrerPolicy="no-referrer" />'
  );
  fs.writeFileSync('index.html', html);
}
