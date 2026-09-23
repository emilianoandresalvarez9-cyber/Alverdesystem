import type { QueuedOperation } from "../../shared/offline/types";
import type { CreditMovementPayload, CustomerAccount } from "./types";

const toCents = (value: number) => Math.round(value * 100);

/** Efecto de un movimiento sobre la deuda (misma regla que credit_movement_delta en SQL). */
export function movementDelta(movement: Pick<CreditMovementPayload, "movementKind" | "amount" | "adjustmentSign">): number {
  if (movement.movementKind === "charge") return movement.amount;
  if (movement.movementKind === "payment") return -movement.amount;
  return movement.amount * (movement.adjustmentSign ?? -1);
}

/**
 * Deuda que este equipo registró y todavía no llegó a la nube: movimientos de fiado y ventas
 * fiadas en la cola. Se suma al saldo de la nube para que un abono sin conexión se vea al instante.
 */
export type PendingInfo = {
  deltas: Map<string, number>;
  newAccounts: CustomerAccount[];
};

export function pendingDeltas(operations: QueuedOperation[]): PendingInfo {
  const cents = new Map<string, number>();
  const add = (customerId: string, value: number) => cents.set(customerId, (cents.get(customerId) ?? 0) + toCents(value));
  const newAccounts: CustomerAccount[] = [];

  for (const operation of operations) {
    if (operation.syncedAt) continue;
    if (operation.kind === "credit_movement") {
      const payload = operation.payload as unknown as CreditMovementPayload;
      if (payload.customerId) add(payload.customerId, movementDelta(payload));
    } else if (operation.kind === "sale") {
      const payload = operation.payload as { paymentMethod?: string; customerId?: string; totalAmount?: number };
      if (payload.paymentMethod === "credit" && payload.customerId) add(payload.customerId, Number(payload.totalAmount ?? 0));
    } else if (operation.kind === "customer") {
      const payload = operation.payload as any;
      newAccounts.push({
        id: operation.localId,
        name: payload.name,
        phone: payload.phone || null,
        credit_limit: payload.creditLimit ?? null,
        balance: 0,
        active: true,
        last_movement_at: null
      });
    }
  }
  return {
    deltas: new Map([...cents].map(([id, value]) => [id, value / 100])),
    newAccounts
  };
}

export function withPending(accounts: CustomerAccount[], pending: PendingInfo): CustomerAccount[] {
  const combined = accounts.map((account) => {
    const extra = pending.deltas.get(account.id);
    return extra ? { ...account, balance: (toCents(account.balance) + toCents(extra)) / 100 } : account;
  });
  return [...combined, ...pending.newAccounts];
}

/** RF-47: el tope lo define la dueña; el sistema solo avisa si una venta lo supera. */
export function exceedsLimit(account: CustomerAccount, extraCharge: number): boolean {
  if (account.credit_limit === null) return false;
  return toCents(account.balance) + toCents(extraCharge) > toCents(account.credit_limit);
}

/** RF-45: buscador por nombre o teléfono, sin distinguir tildes ni mayúsculas. */
export function filterAccounts(accounts: CustomerAccount[], text: string): CustomerAccount[] {
  const needle = normalize(text);
  const digits = text.replace(/\D/g, "");
  if (!needle) return accounts;
  return accounts.filter((account) =>
    normalize(account.name).includes(needle) || (digits.length >= 3 && (account.phone ?? "").replace(/\D/g, "").includes(digits))
  );
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
