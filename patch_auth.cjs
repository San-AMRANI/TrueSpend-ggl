const fs = require('fs');
let code = fs.readFileSync('src/middleware/auth.ts', 'utf8');

code = code.replace(
  "const existingUsers = await db.select().from(users).limit(1);",
  "const existingUsers = await db.select().from(users).where(eq(users.email, 'amranihassan.am@gmail.com')).limit(1);"
);

// We need to import eq from drizzle-orm if it's not already
if (!code.includes("import { eq } from")) {
  code = "import { eq } from 'drizzle-orm';\n" + code;
}

fs.writeFileSync('src/middleware/auth.ts', code);
console.log('Patched auth.ts');
