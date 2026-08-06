const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!code.includes("import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer }")) {
    code = code.replace("import { pgTable, uuid, text, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core';", "import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer } from 'drizzle-orm/pg-core';");
}
code = code.replace("createdAt: timestamp('created_at').defaultNow(),\n});", "createdAt: timestamp('created_at').defaultNow(),\n  payday: integer('payday').default(25),\n});");

fs.writeFileSync('src/db/schema.ts', code);
console.log('Patched schema.ts');
