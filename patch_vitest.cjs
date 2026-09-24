const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace(
  'export default defineConfig({',
  'export default defineConfig({\n  test: {\n    exclude: [\'**/node_modules/**\', \'**/dist/**\', \'**/cypress/**\', \'**/.{idea,git,cache,output,temp}/**\', \'**/e2e/**\']\n  },'
);

fs.writeFileSync('vite.config.ts', code);
