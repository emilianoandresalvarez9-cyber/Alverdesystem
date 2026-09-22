import type { CatalogSnapshot, NewQueuedOperation, QueuedOperation } from "./types";

const DB_NAME = "alverde-offline";
const DB_VERSION = 1;
const OPERATION_STORE = "operations";
const CATALOG_STORE = "catalog";
const SETTING_STORE = "settings";
const queueEvents = new EventTarget();

let databasePromise: Promise<IDBDatabase> | undefined;

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Error de IndexedDB."));
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar en el dispositivo."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La operación local fue cancelada."));
  });
}

function database(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATION_STORE)) {
        const store = db.createObjectStore(OPERATION_STORE, { keyPath: "localId" });
        store.createIndex("syncedAt", "syncedAt");
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(SETTING_STORE)) {
        db.createObjectStore(SETTING_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });

  return databasePromise;
}

function emitQueueChange(): void {
  queueEvents.dispatchEvent(new Event("change"));
}

function uuid(): string {
  return crypto.randomUUID();
}

export async function deviceId(): Promise<string> {
  const db = await database();
  const transaction = db.transaction(SETTING_STORE, "readwrite");
  const store = transaction.objectStore(SETTING_STORE);
  const saved = await requestAsPromise(store.get("device-id")) as { key: string; value: string } | undefined;

  if (saved?.value) {
    await transactionAsPromise(transaction);
    return saved.value;
  }

  const value = uuid();
  store.put({ key: "device-id", value });
  await transactionAsPromise(transaction);
  return value;
}

export async function enqueueOperation<TPayload>(input: NewQueuedOperation<TPayload>): Promise<QueuedOperation<TPayload>> {
  const operation: QueuedOperation<TPayload> = {
    ...input,
    localId: uuid(),
    deviceId: await deviceId(),
    createdAt: new Date().toISOString()
  };

  const db = await database();
  const transaction = db.transaction(OPERATION_STORE, "readwrite");
  transaction.objectStore(OPERATION_STORE).put(operation);
  await transactionAsPromise(transaction);
  emitQueueChange();
  return operation;
}

export async function pendingOperations(): Promise<QueuedOperation[]> {
  const db = await database();
  const transaction = db.transaction(OPERATION_STORE, "readonly");
  const values = await requestAsPromise(transaction.objectStore(OPERATION_STORE).getAll()) as QueuedOperation[];
  await transactionAsPromise(transaction);
  return values
    .filter((operation) => !operation.syncedAt)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function pendingOperationCount(): Promise<number> {
  return (await pendingOperations()).length;
}

export async function markOperationSynced(localId: string): Promise<void> {
  const db = await database();
  const transaction = db.transaction(OPERATION_STORE, "readwrite");
  const store = transaction.objectStore(OPERATION_STORE);
  const operation = await requestAsPromise(store.get(localId)) as QueuedOperation | undefined;

  if (!operation) {
    transaction.abort();
    throw new Error("No se encontró la operación local a sincronizar.");
  }

  store.put({ ...operation, syncedAt: new Date().toISOString(), failedAt: undefined, failureMessage: undefined });
  await transactionAsPromise(transaction);
  emitQueueChange();
}

export async function markOperationFailed(localId: string, reason: string): Promise<void> {
  const db = await database();
  const transaction = db.transaction(OPERATION_STORE, "readwrite");
  const store = transaction.objectStore(OPERATION_STORE);
  const operation = await requestAsPromise(store.get(localId)) as QueuedOperation | undefined;

  if (operation) {
    store.put({ ...operation, failedAt: new Date().toISOString(), failureMessage: reason });
  }

  await transactionAsPromise(transaction);
  emitQueueChange();
}

export async function saveCatalogSnapshot(rows: unknown[]): Promise<void> {
  const db = await database();
  const transaction = db.transaction(CATALOG_STORE, "readwrite");
  transaction.objectStore(CATALOG_STORE).put({
    key: "employee-catalog",
    refreshedAt: new Date().toISOString(),
    rows
  });
  await transactionAsPromise(transaction);
}

export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | undefined> {
  const db = await database();
  const transaction = db.transaction(CATALOG_STORE, "readonly");
  const record = await requestAsPromise(transaction.objectStore(CATALOG_STORE).get("employee-catalog")) as
    | ({ key: string } & CatalogSnapshot)
    | undefined;
  await transactionAsPromise(transaction);
  return record && { refreshedAt: record.refreshedAt, rows: record.rows };
}

export function subscribeToQueueChanges(listener: () => void): () => void {
  queueEvents.addEventListener("change", listener);
  return () => queueEvents.removeEventListener("change", listener);
}

export async function resetOfflineStorageForTests(): Promise<void> {
  const db = await database();
  db.close();
  databasePromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No se pudo limpiar IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB quedó bloqueada durante la limpieza."));
  });
}
