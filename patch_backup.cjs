const fs = require('fs');
let code = fs.readFileSync('src/shared/backup/backupService.ts', 'utf8');

const newMethod = `  /** Restaura un respaldo previamente generado (T-09). */
  public async restoreData(fileContent: string): Promise<void> {
    const backup = JSON.parse(fileContent) as BackupData;
    if (!backup.data) throw new Error("Formato de respaldo invalido.");

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      
      request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento local para restaurar."));
      
      request.onsuccess = () => {
        const db = request.result;
        const storeNames = Object.keys(backup.data).filter(name => db.objectStoreNames.contains(name));
        
        if (storeNames.length === 0) {
          db.close();
          resolve();
          return;
        }

        const transaction = db.transaction(storeNames, "readwrite");
        
        for (const storeName of storeNames) {
          const store = transaction.objectStore(storeName);
          store.clear(); // Limpiar datos actuales
          
          for (const item of backup.data[storeName]) {
            store.put(item); // Restaurar registros
          }
        }
        
        transaction.oncomplete = () => {
          db.close();
          // Emitir un evento para que la app sepa que cambió la base local (ej. la cola de sincronización)
          window.dispatchEvent(new Event("local-db-restored"));
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(new Error("Error al restaurar los datos: " + String(transaction.error)));
        };
      };
    });
  }

}`;

code = code.replace(/}\s*export const backupService = new BackupService\(\);/s, newMethod + '\n\nexport const backupService = new BackupService();');
fs.writeFileSync('src/shared/backup/backupService.ts', code);
