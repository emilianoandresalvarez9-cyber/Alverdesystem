export interface BackupData {
  timestamp: string;
  version: number;
  data: Record<string, any[]>;
}

export class BackupService {
  private dbName: string;

  constructor(dbName: string = 'canti_db') {
    this.dbName = dbName;
  }

  /**
   * Extrae todos los datos de IndexedDB (ventas, stock local, etc.) y retorna el JSON.
   */
  public async extractData(): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);

      request.onerror = (event) => {
        reject(new Error('Error al abrir IndexedDB para el backup.'));
      };

      request.onsuccess = async (event: any) => {
        const db: IDBDatabase = event.target.result;
        const objectStoreNames = Array.from(db.objectStoreNames);
        const backup: BackupData = {
          timestamp: new Date().toISOString(),
          version: db.version,
          data: {}
        };

        if (objectStoreNames.length === 0) {
          db.close();
          return resolve(backup);
        }

        try {
          const transaction = db.transaction(objectStoreNames, 'readonly');

          for (const storeName of objectStoreNames) {
            const store = transaction.objectStore(storeName);
            const allRecords = await this.getAllRecords(store);
            backup.data[storeName] = allRecords;
          }

          transaction.oncomplete = () => {
            db.close();
            resolve(backup);
          };

          transaction.onerror = (e) => {
            db.close();
            reject(new Error('Error al leer datos durante el backup: ' + (e.target as any).error));
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }

  private getAllRecords(store: IDBObjectStore): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Genera el backup de la base de datos y lo devuelve en formato Blob.
   */
  public async generateBackupBlob(): Promise<Blob> {
    const data = await this.extractData();
    const jsonString = JSON.stringify(data, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  /**
   * Descarga el backup manualmente generando un enlace temporal.
   */
  public async downloadBackup(filename?: string): Promise<void> {
    const defaultFilename = `backup_canti_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const finalFilename = filename || defaultFilename;
    
    const blob = await this.generateBackupBlob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const backupService = new BackupService();
