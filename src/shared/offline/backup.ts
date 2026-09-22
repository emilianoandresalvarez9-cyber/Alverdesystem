import { pendingOperations } from "./queue";

type SavedDirectory = { key: "backup-directory"; handle: FileSystemDirectoryHandle };

const DB_NAME = "alverde-offline";
const SETTING_STORE = "settings";

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo acceder al respaldo local."));
  });
}

async function settingsStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el respaldo local."));
  });
  return db.transaction(SETTING_STORE, mode).objectStore(SETTING_STORE);
}

export async function chooseBackupDirectory(): Promise<void> {
  if (!window.showDirectoryPicker) {
    throw new Error("Este navegador no permite elegir una carpeta de respaldo.");
  }

  const handle = await window.showDirectoryPicker();
  const store = await settingsStore("readwrite");
  store.put({ key: "backup-directory", handle } satisfies SavedDirectory);
}

async function savedDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const store = await settingsStore("readonly");
  const saved = await requestAsPromise(store.get("backup-directory")) as SavedDirectory | undefined;
  return saved?.handle;
}

export async function writePendingOperationsBackup(): Promise<"written" | "permission-needed" | "not-configured"> {
  const handle = await savedDirectory();
  if (!handle) return "not-configured";

  const permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") return "permission-needed";

  const file = await handle.getFileHandle("alverde-operaciones-pendientes.json", { create: true });
  const stream = await file.createWritable();
  await stream.write(JSON.stringify({
    exportedAt: new Date().toISOString(),
    pendingOperations: await pendingOperations()
  }, null, 2));
  await stream.close();
  return "written";
}

export async function downloadPendingOperationsBackup(): Promise<void> {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    pendingOperations: await pendingOperations()
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "alverde-operaciones-pendientes.json";
  link.click();
  URL.revokeObjectURL(url);
}
