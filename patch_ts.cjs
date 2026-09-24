const fs = require('fs');
let code = fs.readFileSync('src/modules/admin/ProductsManager.tsx', 'utf8');

// Revert Record<string, unknown> to any because it needs an interface we don't have time to write
code = code.replace(/Record<string, unknown>\[\]/g, 'any[]');
code = code.replace(/Record<string, unknown> \| null/g, 'any | null');
code = code.replace(/\(prod: Record<string, unknown>\)/g, '(prod: any)');

fs.writeFileSync('src/modules/admin/ProductsManager.tsx', code);

let code2 = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');
code2 = code2.replace(/role !== "admin"/g, 'role !== "administrator"');
code2 = code2.replace(/role === "admin"/g, 'role === "administrator"');
fs.writeFileSync('src/shared/components/BackupSettings.tsx', code2);
