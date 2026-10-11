import { getSupabase, SQL_NULL } from "../../shared/supabase/client";
import { allOperations, enqueueOperation, markOperationFailed, markOperationSynced, readSetting, writeSetting } from "../../shared/offline/queue";
import { isPermanentSyncError, synchronizePendingOperations } from "../../shared/offline/sync";
import { pendingDeltas, withPending } from "./balance";
import type { CreditMovementPayload, CreditMovementRow, CustomerAccount } from "./types";

const CACHE_KEY = "customer-accounts";

type Cached = { refreshedAt: string; accounts: CustomerAccount[] };

export type AccountsResult = { accounts: CustomerAccount[]; refreshedAt: string | null; fromCache: boolean };

/**
 * Error a mostrar cuando no hay copia en el equipo. Con conexión, el problema no es la conexión:
 * se muestra el motivo real (por ejemplo, un permiso faltante en la base) en vez de "Sin conexión".
 */
export function accountsLoadError(online: boolean, cause: unknown): Error {
  if (!online) return new Error("Sin conexión y sin una copia de clientes en este equipo. Conectate una vez para descargarla.");
  const detail = cause instanceof Error ? cause.message
    : cause && typeof cause === "object" && "message" in cause ? String((cause as { message: unknown }).message)
    : String(cause);
  return new Error(`No se pudieron cargar los clientes: ${detail}`);
}

/**
 * Cuentas con saldo. Con conexión vienen de la nube y se guardan en el equipo; sin conexión se
 * usa la última copia. En ambos casos se suma lo que este equipo registró y todavía no envió.
 */
export async function loadAccounts(): Promise<AccountsResult> {
  let base: Cached | undefined;
  let fromCache = false;
  try {
    const { data, error } = await getSupabase().from("customer_accounts").select("*").order("name");
    if (error) throw error;
    base = {
      refreshedAt: new Date().toISOString(),
      accounts: (data ?? []).map((row) => ({
        ...(row as CustomerAccount),
        balance: Number(row.balance),
        credit_limit: row.credit_limit === null ? null : Number(row.credit_limit)
      }))
    };
    await writeSetting(CACHE_KEY, base);
  } catch (error) {
    base = await readSetting<Cached>(CACHE_KEY);
    fromCache = true;
    if (!base) throw accountsLoadError(typeof navigator === "undefined" ? false : navigator.onLine, error);
  }
  const pending = pendingDeltas(await allOperations());
  return { accounts: withPending(base.accounts, pending), refreshedAt: base.refreshedAt, fromCache };
}

/**
 * Alta idempotente (RF-45). Se conserva el localId de una solicitud igual que ya esté pendiente,
 * y la pantalla solo confirma el alta después de que sync_offline_customer responda correctamente.
 * El ID compartido es necesario para que los movimientos locales de fiado apunten al cliente remoto.
 */
export async function createCustomer(input: { name: string; phone?: string; creditLimit?: number | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");

  const phone = input.phone?.trim() || null;
  const creditLimit = input.creditLimit ?? null;
  if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
    throw new Error("El tope de fiado debe ser un número válido igual o mayor a cero.");
  }

  const operations = await allOperations();
  const pendingCustomer = operations.find((operation) => {
    if (operation.kind !== "customer" || operation.syncedAt) return false;
    const payload = operation.payload as { name?: unknown; phone?: unknown; creditLimit?: unknown };
    return payload.name === name
      && (payload.phone || null) === phone
      && (payload.creditLimit ?? null) === creditLimit;
  });
  const localId = pendingCustomer?.localId ?? (await enqueueOperation({
    kind: "customer",
    payload: { name, phone, creditLimit }
  })).localId;

  let error: { message: string; code?: string } | null = null;
  try {
    ({ error } = await getSupabase().rpc("sync_offline_customer", {
      p_id: localId,
      p_name: name,
      p_phone: phone ?? SQL_NULL,
      p_credit_limit: creditLimit ?? SQL_NULL
    }));
  } catch (caught) {
    error = caught instanceof Error ? { message: caught.message } : { message: "Falló la solicitud de alta del cliente." };
  }

  if (error) {
    await markOperationFailed(localId, error.message, error.code, !isPermanentSyncError(error.code));
    throw new Error(`No se pudo guardar el cliente: ${error.message}`);
  }

  await markOperationSynced(localId);
}

/** RF-47: solo la administradora (lo controla la base). null = sin tope. */
export async function setCreditLimit(customerId: string, limit: number | null): Promise<void> {
  const { error } = await getSupabase().from("customers").update({ credit_limit: limit }).eq("id", customerId);
  if (error) throw new Error(error.code === "42501" ? "Solo la administradora define el tope de fiado." : error.message);
}

/** Cargo, abono o ajuste. Se guarda primero en el equipo (RF-35) y se envía cuando hay red. */
export async function registerMovement(movement: CreditMovementPayload): Promise<void> {
  if (!(movement.amount > 0)) throw new Error("El monto tiene que ser mayor a cero.");
  if (movement.movementKind === "adjustment" && !movement.adjustmentSign) {
    throw new Error("Indicá si el ajuste sube o baja la deuda.");
  }
  await enqueueOperation({ kind: "credit_movement", payload: movement });
  void synchronizePendingOperations().catch(() => undefined);
}

export async function loadMovements(customerId: string): Promise<CreditMovementRow[]> {
  const { data, error } = await getSupabase().rpc("customer_movements", { p_customer_id: customerId });
  if (error) throw new Error(`No se pudo cargar el historial: ${error.message}`);
  return ((data ?? []) as CreditMovementRow[]).map((row) => ({ ...row, amount: Number(row.amount), delta: Number(row.delta) }));
}
