const fs = require('fs');
let code = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');

const importAdd = `import { backupService } from "../backup/backupService";\nimport { useRef } from "react";`;
code = code.replace(/import \{ Button \} from "\.\.\/ui";/, "import { Button } from \"../ui\";\n" + importAdd);

const uiAdd = `  const fileInputRef = useRef<HTMLInputElement>(null);
  
  async function handleRestoreOfflineBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage("Leyendo archivo de respaldo offline...");
    try {
      const text = await file.text();
      await backupService.restoreData(text);
      setMessage("Respaldo offline restaurado correctamente. Recargue la página si es necesario.");
    } catch (error: any) {
      setMessage("Error al restaurar: " + error.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }`;

code = code.replace(/const \[backupLoading, setBackupLoading\] = useState\(false\);/, "const [backupLoading, setBackupLoading] = useState(false);\n" + uiAdd);

const jsxAdd = `      <div style={{ marginTop: "1rem" }}>
        <h3>Restaurar Respaldo Offline</h3>
        <p style={{ fontSize: "0.85rem", opacity: 0.8, marginBottom: "0.5rem" }}>
          Si hubo un problema con IndexedDB, podés restaurar un archivo de cierre o un JSON generado localmente.
        </p>
        <Button variant="secundario" onClick={() => fileInputRef.current?.click()}>
          Seleccionar Archivo JSON
        </Button>
        <input 
          type="file" 
          accept="application/json" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleRestoreOfflineBackup}
        />
      </div>`;

code = code.replace(/<\/div>\n    <\/GlassCard>/, jsxAdd + "\n      </div>\n    </GlassCard>");

fs.writeFileSync('src/shared/components/BackupSettings.tsx', code);
