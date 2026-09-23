import { getSupabase } from "../../shared/supabase/client";
import { allOperations, enqueueOperation, readSetting, writeSetting } from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";
import { pendingDeltas, withPending } from "./balance";
import type { CreditMovementPayload, CreditMovementRow, CustomerAccount } from "./types";

const CACHE_KEY = "customer-accounts";

type Cached = { refreshedAt: string; accounts: CustomerAccount[] };

export type AccountsResult = { accounts: CustomerAccount[]; refreshedAt: string | null; fromCache: boolean };

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
    if (!base) throw new Error("Sin conexión y sin una copia de clientes en este equipo. Conectate una vez para descargarla.");
  }
  const pending = pendingDeltas(await allOperations());
  return { accounts: withPending(base.accounts, pending), refreshedAt: base.refreshedAt, fromCache };
}

/** Alta de cliente (RF-45). Soporta offline (T-13). */
export async function createCustomer(input: { name: string; phone?: string; creditLimit?: number | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");

  await enqueueOperation({
    kind: "customer",
    payload: {
      name,
      phone: input.phone?.trim() || null,
      creditLimit: input.creditLimit
    }
  });

  synchronizePendingOperations().catch(console.error);
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
