const fs = require('fs');
let c = fs.readFileSync('src/modules/admin/BackupManager.tsx', 'utf8');

const target = `  const handleExportCsv = async (tableName: string) => {
    setLoading(true);
    setMessage(\`Exportando tabla \${tableName}...\`);
    try {
      const data = await generateFullBackup();
      const tableData = (data.tables as SupabaseAny)[tableName];
      exportToCsv(tableName, tableData || []);
      setMessage("Exportacion completada.");
    } catch (error: SupabaseAny) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };`;

const replace = `  const handleExportCsv = async (tableName: string) => {
    setLoading(true);
    setMessage(\`Exportando tabla \${tableName}...\`);
    try {
      const sb = getSupabase();
      const { data: tableData, error } = await sb.from(tableName).select("*");
      if (error) throw new Error(error.message);
      exportToCsv(tableName, tableData || []);
      setMessage("Exportacion completada.");
    } catch (error: SupabaseAny) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };`;

c = c.replace(target, replace);
c = c.replace('import { generateFullBackup, downloadBackupFile, exportToCsv, restoreFullBackup, type FullBackupData } from "../../shared/offline/fullBackup";', 'import { generateFullBackup, downloadBackupFile, exportToCsv, restoreFullBackup, type FullBackupData } from "../../shared/offline/fullBackup";\nimport { getSupabase } from "../../shared/supabase/client";');

fs.writeFileSync('src/modules/admin/BackupManager.tsx', c, 'utf8');
