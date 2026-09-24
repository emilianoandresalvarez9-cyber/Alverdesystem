const fs = require('fs');
let code = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');

code = code.replace(
  /\{role === "admin" && <Button variant="primario"[\s\S]*?<\/Button>/,
  '{role === "admin" && (<Button variant="primario" onClick={handleFullBackup} disabled={backupLoading}>\n          {backupLoading ? "Generando..." : "Descargar DB Completa"}\n        </Button>)}'
);

fs.writeFileSync('src/shared/components/BackupSettings.tsx', code);
