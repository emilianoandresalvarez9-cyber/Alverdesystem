import { OFFLINE_DB_NAME } from "../offline/queue";

export interface BackupData {
  timestamp: string;
  version: number;
  data: Record<string, unknown[]>;
}

export class BackupService {
  private dbName: string;

  /**
   * Por defecto respalda la base real de la app. Antes el valor por defecto era 'canti_db',
   * una base que no existe: el navegador la creaba vacía y cada respaldo de cierre salía sin datos.
   */
  constructor(dbName: string = OFFLINE_DB_NAME) {
    this.dbName = dbName;
  }

  /** Extrae todos los almacenes de IndexedDB (cola de operaciones, catálogo local, preferencias). */
  public extractData(): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);

      request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento local para el respaldo."));

      request.onsuccess = () => {
        const db = request.result;
        const storeNames = Array.from(db.objectStoreNames);
        const backup: BackupData = { timestamp: new Date().toISOString(), version: db.version, data: {} };

        if (storeNames.length === 0) {
          db.close();
          resolve(backup);
          return;
        }

        // Todas las lecturas se lanzan en la misma transacción y se resuelve al completarla.
        const transaction = db.transaction(storeNames, "readonly");
        for (const storeName of storeNames) {
          const read = transaction.objectStore(storeName).getAll();
          read.onsuccess = () => {
            backup.data[storeName] = read.result as unknown[];
          };
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(backup);
        };
        transaction.onerror = () => {
          db.close();
          reject(new Error("Error al leer datos durante el respaldo: " + String(transaction.error)));
        };
      };
    });
  }

  public async generateBackupBlob(): Promise<Blob> {
    const data = await this.extractData();
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  }

  /** Descarga el respaldo como archivo JSON. */
  public async downloadBackup(filename?: string): Promise<void> {
    const finalFilename = filename ?? `respaldo_alverde_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const blob = await this.generateBackupBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  /** Restaura un respaldo previamente generado (T-09). */
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
          
          const items = backup.data[storeName];
          if (items) {
            for (const item of items) {
              store.put(item); // Restaurar registros
            }
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

}

export const backupService = new BackupService();
