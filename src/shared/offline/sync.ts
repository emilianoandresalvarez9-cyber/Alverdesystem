import { getSupabase, SQL_NULL } from "../supabase/client";
import type { Json } from "../supabase/database.types";
import { markOperationFailed, markOperationSynced, pendingOperations } from "./queue";
import { upgradeLegacyOperations } from "./legacy";
import type { QueuedOperation } from "./types";

export type SyncResult = {
  synchronized: number;
  failed: number;
};

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
let retryTimeout: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000;

export function synchronizePendingOperations(): Promise<SyncResult> {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
  }
  
  inFlight ??= runSynchronization().then((result) => {
    inFlight = undefined;
    if (result.failed > 0 && navigator.onLine) {
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

async function runSynchronization(): Promise<SyncResult> {
  if (!navigator.onLine) return { synchronized: 0, failed: 0 };

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

  for (const operation of operations) {
    const { error } = await sendOperation(operation);

    if (error) {
      failed += 1;
      await markOperationFailed(operation.localId, error.message);
      continue;
    }

    synchronized += 1;
    await markOperationSynced(operation.localId);
  }

  return { synchronized, failed };
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
