const fs = require('fs');

// 1. ScaleManager.tsx
let sm = fs.readFileSync('src/modules/admin/ScaleManager.tsx', 'utf8');
sm = sm.replace(/variant="success"/g, 'tone="success"');
sm = sm.replace(/variant="warning"/g, 'tone="warning"');
fs.writeFileSync('src/modules/admin/ScaleManager.tsx', sm);

// 2. BackupSettings.tsx
let bs = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');
bs = bs.replace("import { useAuth } from '../auth/useAuth';", "import { useCurrentProfile } from '../auth/AuthGate';");
bs = bs.replace("const { role } = useAuth();", "const { role } = useCurrentProfile();");
fs.writeFileSync('src/shared/components/BackupSettings.tsx', bs);

// 3. vite.config.ts
let vc = fs.readFileSync('vite.config.ts', 'utf8');
if (!vc.includes('/// <reference types="vitest" />')) {
  vc = '/// <reference types="vitest" />\n' + vc;
}
fs.writeFileSync('vite.config.ts', vc);
