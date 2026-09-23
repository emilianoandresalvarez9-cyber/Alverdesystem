import { getSupabase } from "../supabase/client";
import { markOperationFailed, markOperationSynced, pendingOperations } from "./queue";
import { upgradeLegacyOperations } from "./legacy";

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

/**
 * Envía la cola en orden. Si ya hay una sincronización en curso, devuelve esa misma promesa en
 * lugar de mandar las operaciones dos veces en paralelo.
 */
export function synchronizePendingOperations(): Promise<SyncResult> {
  inFlight ??= runSynchronization().finally(() => {
    inFlight = undefined;
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
    let rpcName = "apply_offline_operation";
    let payload: Record<string, unknown> = { p_operation: operation };

    if (operation.kind === "sale") {
      rpcName = "process_offline_sale";
      payload = { payload: operation };
    } else if (operation.kind === "customer") {
      rpcName = "sync_offline_customer";
      payload = {
        p_id: operation.localId,
        p_name: operation.payload.name,
        p_phone: operation.payload.phone || null,
        p_credit_limit: operation.payload.creditLimit ?? null
      };
    }

    const { error } = await getSupabase().rpc(rpcName, payload);

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

export function startOfflineSynchronization(): () => void {
  const sync = () => void synchronizePendingOperations().catch((error: unknown) => {
    console.warn("La sincronización quedará para el próximo reintento.", error);
  });

  addEventListener("online", sync);
  sync();

  return () => removeEventListener("online", sync);
}
