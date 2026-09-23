import type { QueuedOperation } from "./types";

type DirectoryHandle = {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(content: string): Promise<void>; close(): Promise<void> }>;
  }>;
};

type SavedDirectory = { key: "backup-directory"; handle: DirectoryHandle };
const DB_NAME = "alverde-offline";
const SETTING_STORE = "settings";

// NOTA: backup.ts NO cachea la conexion a IndexedDB porque es un modulo
// auxiliar que se usa ocasionalmente. Cada funcion abre, usa y CIERRA
// la conexion dentro de la misma llamada.
//
// Es critico llamar db.close() al finalizar cada transaccion. Si la
// conexion queda abierta, IDBFactory.deleteDatabase() (usado en tests)
// dispara onblocked y el afterEach hace timeout.
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Sin numero de version: abre la DB en el estado actual sin upgrade.
    // Esto es intencional: backup.ts solo usa el store 'settings' que
    // queue.ts ya crea en su onupgradeneeded.
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el respaldo local."));
  });
}

async function readDirectory(): Promise<DirectoryHandle | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTING_STORE, "readonly");
    const request = transaction.objectStore(SETTING_STORE).get("backup-directory");
    let saved: SavedDirectory | undefined;
    request.onsuccess = () => { saved = request.result as SavedDirectory | undefined; };
    transaction.oncomplete = () => {
      // Cerrar la conexion inmediatamente: si no lo hacemos, la DB queda
      // con una conexion abierta que bloquea deleteDatabase() en los tests.
      db.close();
      resolve(saved?.handle);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("No se pudo leer la carpeta de respaldo."));
    };
  });
}

async function saveDirectory(handle: DirectoryHandle): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTING_STORE, "readwrite");
    transaction.objectStore(SETTING_STORE).put({ key: "backup-directory", handle } satisfies SavedDirectory);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("No se pudo guardar la carpeta de respaldo."));
    };
  });
}

function payload(operations: QueuedOperation[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    pendingOperations: operations
  }, null, 2);
}

export async function chooseBackupDirectory(): Promise<void> {
  if (!window.showDirectoryPicker) {
    throw new Error("Este navegador no permite elegir una carpeta de respaldo.");
  }
  await saveDirectory(await window.showDirectoryPicker());
}

export async function tryWritePendingOperationsBackup(
  operations: QueuedOperation[]
): Promise<"written" | "permission-needed" | "not-configured"> {
  const directory = await readDirectory();
  if (!directory) return "not-configured";

  if (await directory.queryPermission({ mode: "readwrite" }) !== "granted") {
    return "permission-needed";
  }

  const file = await directory.getFileHandle("alverde-operaciones-pendientes.json", { create: true });
  const stream = await file.createWritable();
  await stream.write(payload(operations));
  await stream.close();
  return "written";
}

export function downloadPendingOperationsBackup(operations: QueuedOperation[]): void {
  const url = URL.createObjectURL(new Blob([payload(operations)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "alverde-operaciones-pendientes.json";
  link.click();
  URL.revokeObjectURL(url);
}
