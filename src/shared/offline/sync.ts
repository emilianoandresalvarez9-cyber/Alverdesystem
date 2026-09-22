import { getSupabase } from "../supabase/client";
import {
  markOperationFailed,
  markOperationSynced,
  pendingOperations,
  saveCatalogSnapshot
} from "./queue";

export type SyncResult = {
  synchronized: number;
  failed: number;
};

export async function synchronizePendingOperations(): Promise<SyncResult> {
  if (!navigator.onLine) return { synchronized: 0, failed: 0 };

  const operations = await pendingOperations();
  let synchronized = 0;
  let failed = 0;

  for (const operation of operations) {
    const { error } = await getSupabase().rpc("apply_offline_operation", {
      p_operation: operation
    });

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

export async function refreshEmployeeCatalog(): Promise<unknown[]> {
  const { data, error } = await getSupabase()
    .from("employee_catalog")
    .select("*")
    .order("product_name", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  await saveCatalogSnapshot(rows);
  return rows;
}

export function startOfflineSynchronization(): () => void {
  const sync = () => void synchronizePendingOperations().catch((error: unknown) => {
    console.warn("La sincronización quedará para el próximo reintento.", error);
  });

  addEventListener("online", sync);
  sync();

  return () => removeEventListener("online", sync);
}
