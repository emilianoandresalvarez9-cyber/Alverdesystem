import { OFFLINE_DB_NAME } from "../offline/queue";

const OPERATIONS_STORE = "operations";

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
  /**
   * Recupera operaciones pendientes desde un respaldo (T-09) SIN borrar nada del equipo.
   * La versión anterior hacía store.clear() y reemplazaba toda la base local: en un equipo con
   * ventas nuevas sin enviar, esas ventas se perdían, y además pisaba la caja asignada y el turno.
   * Ahora solo agrega las operaciones cuyo localId no existe; la idempotencia en la nube evita
   * duplicados al enviarlas. Se puede repetir con el mismo archivo sin efecto.
   */
  public async mergePendingOperations(fileContent: string): Promise<{ added: number; skipped: number }> {
    let backup: BackupData;
    try {
      backup = JSON.parse(fileContent) as BackupData;
    } catch {
      throw new Error("El archivo no es un respaldo válido (no es JSON).");
    }
    const incoming = backup?.data?.[OPERATIONS_STORE];
    if (!Array.isArray(incoming)) throw new Error("El archivo no contiene operaciones de la cola.");
    const operations = incoming.filter(
      (item): item is { localId: string } =>
        typeof item === "object" && item !== null && typeof (item as { localId?: unknown }).localId === "string"
    );

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento local."));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OPERATIONS_STORE)) {
          db.close();
          reject(new Error("Este equipo todavía no tiene cola de operaciones. Abrí la caja una vez y reintentá."));
          return;
        }
        const transaction = db.transaction(OPERATIONS_STORE, "readwrite");
        const store = transaction.objectStore(OPERATIONS_STORE);
        let added = 0;
        let skipped = 0;
        for (const operation of operations) {
          const check = store.getKey(operation.localId);
          check.onsuccess = () => {
            if (check.result === undefined) {
              store.add(operation);
              added += 1;
            } else {
              skipped += 1;
            }
          };
        }
        transaction.oncomplete = () => {
          db.close();
          if (typeof window !== "undefined") window.dispatchEvent(new Event("local-db-restored"));
          resolve({ added, skipped });
        };
        transaction.onerror = () => {
          db.close();
          reject(new Error("No se pudieron recuperar las operaciones: " + String(transaction.error)));
        };
      };
    });
  }
}

export const backupService = new BackupService();
