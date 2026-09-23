import { tryWritePendingOperationsBackup } from "./backup";
import type { CatalogSnapshot, NewQueuedOperation, QueuedOperation } from "./types";

const DB_NAME = "alverde-offline";
const DB_VERSION = 1;
const OPERATION_STORE = "operations";
const CATALOG_STORE = "catalog";
const SETTING_STORE = "settings";
const queueEvents = new EventTarget();

let databasePromise: Promise<IDBDatabase> | undefined;

// Referencia a la ultima llamada de mirrorPendingQueue() en vuelo.
// resetOfflineStorageForTests() hace await sobre esta promesa antes de
// cerrar la base, garantizando que no queden conexiones abiertas cuando
// se llama a deleteDatabase(). Esto resuelve la condicion de carrera:
//   void mirrorPendingQueue() -> promesa en vuelo -> db.close() -> onblocked
let pendingMirror: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATION_STORE)) {
        const store = db.createObjectStore(OPERATION_STORE, { keyPath: "localId" });
        store.createIndex("syncedAt", "syncedAt");
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) db.createObjectStore(CATALOG_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(SETTING_STORE)) db.createObjectStore(SETTING_STORE, { keyPath: "key" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });

  return databasePromise;
}

async function readRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    let result: T | undefined;

    request.onsuccess = () => { result = request.result as T | undefined; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo leer el almacenamiento local."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La lectura local fue cancelada."));
  });
}

async function readAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    let result: T[] = [];

    request.onsuccess = () => { result = request.result as T[]; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo leer el almacenamiento local."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La lectura local fue cancelada."));
  });
}

async function putRecord(storeName: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar en el dispositivo."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La operacion local fue cancelada."));
  });
}

function emitQueueChange(): void {
  queueEvents.dispatchEvent(new Event("change"));
}

function uuid(): string {
  return crypto.randomUUID();
}

async function mirrorPendingQueue(): Promise<void> {
  try {
    await tryWritePendingOperationsBackup(await pendingOperations());
  } catch (error) {
    // El browser puede revocar temporalmente el permiso de directorio.
    // Los datos quedan seguros en IndexedDB y se reintentara en la proxima operacion.
    console.warn("No se pudo actualizar la segunda copia local.", error);
  }
}

export async function deviceId(): Promise<string> {
  const saved = await readRecord<{ key: string; value: string }>(SETTING_STORE, "device-id");
  if (saved?.value) return saved.value;

  const value = uuid();
  await putRecord(SETTING_STORE, { key: "device-id", value });
  return value;
}

export async function enqueueOperation<TPayload>(input: NewQueuedOperation<TPayload>): Promise<QueuedOperation<TPayload>> {
  const operation: QueuedOperation<TPayload> = {
    ...input,
    localId: uuid(),
    deviceId: await deviceId(),
    createdAt: new Date().toISOString()
  };

  await putRecord(OPERATION_STORE, operation);
  emitQueueChange();
  // Fire-and-forget en produccion, pero trackeado para que resetOfflineStorageForTests()
  // pueda hacer await antes de cerrar la DB.
  pendingMirror = mirrorPendingQueue();
  return operation;
}

export async function pendingOperations(): Promise<QueuedOperation[]> {
  const values = await readAll<QueuedOperation>(OPERATION_STORE);
  return values
    .filter((operation) => !operation.syncedAt)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function pendingOperationCount(): Promise<number> {
  return (await pendingOperations()).length;
}

export async function markOperationSynced(localId: string): Promise<void> {
  const operation = await readRecord<QueuedOperation>(OPERATION_STORE, localId);
  if (!operation) throw new Error("No se encontro la operacion local a sincronizar.");

  await putRecord(OPERATION_STORE, {
    ...operation,
    syncedAt: new Date().toISOString(),
    failedAt: undefined,
    failureMessage: undefined
  });
  emitQueueChange();
  pendingMirror = mirrorPendingQueue();
}

export async function markOperationFailed(localId: string, reason: string): Promise<void> {
  const operation = await readRecord<QueuedOperation>(OPERATION_STORE, localId);
  if (!operation) return;

  await putRecord(OPERATION_STORE, {
    ...operation,
    failedAt: new Date().toISOString(),
    failureMessage: reason
  });
  emitQueueChange();
  pendingMirror = mirrorPendingQueue();
}

export async function saveCatalogSnapshot(rows: unknown[]): Promise<void> {
  await putRecord(CATALOG_STORE, {
    key: "employee-catalog",
    refreshedAt: new Date().toISOString(),
    rows
  });
}

export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | undefined> {
  const record = await readRecord<({ key: string } & CatalogSnapshot)>(CATALOG_STORE, "employee-catalog");
  return record && { refreshedAt: record.refreshedAt, rows: record.rows };
}

export function subscribeToQueueChanges(listener: () => void): () => void {
  queueEvents.addEventListener("change", listener);
  return () => queueEvents.removeEventListener("change", listener);
}

export async function resetOfflineStorageForTests(): Promise<void> {
  // Esperar a que termine el ultimo mirror en vuelo antes de cerrar la DB.
  // Si hacemos db.close() mientras mirrorPendingQueue() tiene una transaccion
  // abierta, IDBOpenDBRequest.onblocked bloquea deleteDatabase() y el test
  // falla por timeout. El await aqui garantiza que no hay conexiones en vuelo.
  await pendingMirror;

  const db = await openDatabase();
  db.close();
  databasePromise = undefined;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No se pudo limpiar IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB quedo bloqueada durante la limpieza."));
  });
}
