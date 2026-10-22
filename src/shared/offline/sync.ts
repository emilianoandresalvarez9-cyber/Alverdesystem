import { getSupabase, SQL_NULL } from "../supabase/client";
import type { Json } from "../supabase/database.types";
import { markOperationFailed, markOperationSynced, pendingOperations } from "./queue";
import { upgradeLegacyOperations } from "./legacy";
import type { QueuedOperation } from "./types";

export type SyncResult = {
  synchronized: number;
  failed: number;
  rejected: number;
};

export type SyncOptions = { retryRejected?: boolean };

/**
 * Los errores de integridad (23), datos inválidos (22: overflow numérico, formato), reglas de
 * negocio (P0001/P0002 salvo espera explícita de turno), permisos o esquema no se resuelven
 * esperando: requieren corregir datos/configuración.
 */
export function isPermanentSyncError(code?: string, message?: string): boolean {
  if (!code) return false;
  if (code === "P0002" && message?.includes("se reintentará")) return false;
  return (
    code.startsWith("23") ||
    code.startsWith("22") ||
    code === "P0001" ||
    code === "P0002" ||
    ["42501", "42703", "42883", "42P01"].includes(code)
  );
}

type PreSyncStep = () => Promise<void>;
const preSyncSteps = new Set<PreSyncStep>([async () => { await upgradeLegacyOperations(); }]);

/**
 * Pasos que deben correr antes de enviar la cola (por ejemplo, crear en la nube el turno de caja
 * que se abrió sin conexión, porque las ventas lo referencian). Devuelve la función para quitarlo.
 */
export function registerPreSyncStep(step: PreSyncStep): () => void {
  preSyncSteps.add(step);
  return () => preSyncSteps.delete(step);
}

let inFlight: Promise<SyncResult> | undefined;
let followUp: Promise<SyncResult> | undefined;
let followUpRetryRejected = false;
let retryTimeout: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000;

/**
 * Una pasada lee la cola al empezar. Lo que se encola mientras corre (una venta cobrada durante el
 * envío de la anterior) no estaba en esa lectura: se envía en una pasada siguiente, apenas termina
 * la actual, en vez de esperar otro evento (RF-35). Todos los pedidos que llegan durante una
 * pasada comparten la siguiente, y si alguno pidió reintentar las rechazadas, la siguiente lo hace.
 */
export function synchronizePendingOperations(options: SyncOptions = {}): Promise<SyncResult> {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
  }

  if (inFlight) {
    followUpRetryRejected ||= options.retryRejected === true;
    followUp ??= inFlight.catch(() => undefined).then(() => {
      const retryRejected = followUpRetryRejected;
      followUp = undefined;
      followUpRetryRejected = false;
      return synchronizePendingOperations({ retryRejected });
    });
    return followUp;
  }

  inFlight = runSynchronization(options.retryRejected === true).then((result) => {
    inFlight = undefined;
    if (result.failed > result.rejected && navigator.onLine) {
      console.warn("Reintentando en " + retryDelay + "ms");
      retryTimeout = setTimeout(() => {
        void synchronizePendingOperations();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 120000);
    } else {
      retryDelay = 2000;
    }
    return result;
  }).catch((err) => {
    inFlight = undefined;
    throw err;
  });
  return inFlight;
}

async function runSynchronization(retryRejected: boolean): Promise<SyncResult> {
  if (!navigator.onLine) return { synchronized: 0, failed: 0, rejected: 0 };

  for (const step of preSyncSteps) {
    try {
      await step();
    } catch (error) {
      console.warn("Un paso previo a la sincronización falló; se reintentará.", error);
    }
  }

  const operations = await pendingOperations();
  let synchronized = 0;
  let failed = 0;
  let rejected = 0;

  for (const operation of operations) {
    if (operation.retryable === false && !retryRejected) {
      failed += 1;
      rejected += 1;
      continue;
    }

    let error: { message: string; code?: string } | null = null;
    try {
      ({ error } = await sendOperation(operation));
    } catch (caught) {
      error = caught instanceof Error ? { message: caught.message } : { message: "Falló la solicitud de sincronización." };
    }

    if (error) {
      failed += 1;
      const permanent = isPermanentSyncError(error.code, error.message);
      if (permanent) rejected += 1;
      await markOperationFailed(operation.localId, error.message, error.code, !permanent);
      continue;
    }

    synchronized += 1;
    await markOperationSynced(operation.localId);
  }

  return { synchronized, failed, rejected };
}

/** Cada tipo de operación va a su RPC, con argumentos tipados contra el esquema real. */
function sendOperation(operation: QueuedOperation) {
  const supabase = getSupabase();
  const asJson = operation as unknown as Json;
  switch (operation.kind) {
    case "sale":
      return supabase.rpc("process_offline_sale", { payload: asJson });
    case "customer": {
      const customer = operation.payload as { name?: string; phone?: string | null; creditLimit?: number | null };
      return supabase.rpc("sync_offline_customer", {
        p_id: operation.localId,
        p_name: customer.name ?? "",
        p_phone: customer.phone || SQL_NULL,
        p_credit_limit: customer.creditLimit ?? SQL_NULL
      });
    }
    default:
      return supabase.rpc("apply_offline_operation", { p_operation: asJson });
  }
}

export function startOfflineSynchronization(): () => void {
  const sync = () => void synchronizePendingOperations().catch((error: unknown) => {
    console.warn("La sincronización quedará para el próximo reintento.", error);
  });

  addEventListener("online", sync);
  sync();

  return () => removeEventListener("online", sync);
}
