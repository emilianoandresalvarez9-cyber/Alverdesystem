import { getSupabase } from "../../shared/supabase/client";
import { allOperations, readSetting, writeSetting } from "../../shared/offline/queue";
import { registerPreSyncStep, synchronizePendingOperations } from "../../shared/offline/sync";
import { backupService } from "../../shared/backup/backupService";
import { summarizeShift, type ShiftSummary } from "./shiftSummary";
import type { CurrentShift } from "./types";

const REGISTER_KEY = "pos-register";
const SHIFT_KEY = "pos-current-shift";

export type RegisterOption = { id: string; name: string; branchName: string };

/** Caja asignada a este dispositivo (se elige una vez por equipo). */
export async function assignedRegister(): Promise<RegisterOption | undefined> {
  return readSetting<RegisterOption>(REGISTER_KEY);
}

export async function assignRegister(register: RegisterOption): Promise<void> {
  await writeSetting(REGISTER_KEY, register);
}

export async function listRegisters(): Promise<RegisterOption[]> {
  const { data, error } = await getSupabase()
    .from("registers")
    .select("id, name, archived_at, branch:branches(name)")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`No se pudieron cargar las cajas: ${error.message}`);
  return (data ?? []).map((row) => {
    const branch = row.branch as unknown as { name: string } | { name: string }[] | null;
    const branchName = Array.isArray(branch) ? branch[0]?.name ?? "" : branch?.name ?? "";
    return { id: row.id as string, name: row.name as string, branchName };
  });
}

export async function currentShift(): Promise<CurrentShift | undefined> {
  return readSetting<CurrentShift>(SHIFT_KEY);
}

/**
 * Abre el turno. Se guarda primero en el dispositivo (así se puede vender sin conexión) y se
 * crea en la nube apenas haya red; las ventas lo referencian, por eso la sincronización lo
 * persiste antes de enviar la cola.
 */
export async function openShift(register: RegisterOption, initialBalance: number): Promise<CurrentShift> {
  const existing = await currentShift();
  if (existing) return existing;

  const resumed = await findOwnOpenShift(register);
  const shift: CurrentShift = resumed ?? {
    id: crypto.randomUUID(),
    registerId: register.id,
    registerName: register.name,
    openedAt: new Date().toISOString(),
    initialBalance,
    persisted: false
  };
  await writeSetting(SHIFT_KEY, shift);
  if (!shift.persisted) await persistShift();
  return (await currentShift()) ?? shift;
}

/** Si la cajera dejó un turno abierto en esta caja (por ejemplo, se cortó la luz), lo retoma. */
async function findOwnOpenShift(register: RegisterOption): Promise<CurrentShift | undefined> {
  if (!navigator.onLine) return undefined;
  const { data: auth } = await getSupabase().auth.getUser();
  if (!auth.user) return undefined;
  const { data } = await getSupabase()
    .from("cash_shifts")
    .select("id, opened_at, initial_balance")
    .eq("register_id", register.id)
    .eq("user_id", auth.user.id)
    .eq("status", "open")
    .maybeSingle();
  if (!data) return undefined;
  return {
    id: data.id as string,
    registerId: register.id,
    registerName: register.name,
    openedAt: data.opened_at as string,
    initialBalance: Number(data.initial_balance),
    persisted: true
  };
}

/** Crea en la nube el turno abierto sin conexión. Idempotente. */
export async function persistShift(): Promise<void> {
  const shift = await currentShift();
  if (!shift || shift.persisted || !navigator.onLine) return;

  const { data: auth } = await getSupabase().auth.getUser();
  if (!auth.user) return;

  const { error } = await getSupabase().from("cash_shifts").upsert(
    {
      id: shift.id,
      register_id: shift.registerId,
      user_id: auth.user.id,
      opened_at: shift.openedAt,
      initial_balance: shift.initialBalance
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) {
    if (error.code === "23505") {
      throw new Error(`La ${shift.registerName} ya tiene un turno abierto de otra persona. Pedile que lo cierre o avisale a la administradora.`);
    }
    throw new Error(`No se pudo registrar el turno: ${error.message}`);
  }
  await writeSetting(SHIFT_KEY, { ...shift, persisted: true });
}

registerPreSyncStep(persistShift);

export async function shiftSummary(shift: CurrentShift): Promise<ShiftSummary> {
  return summarizeShift(await allOperations(), shift.id);
}

export type CloseResult =
  | { closed: true; summary: ShiftSummary; expectedCash: number; backupError?: string }
  | { closed: false; summary: ShiftSummary; reason: string };

/**
 * Cierre de caja (RF-32, RF-41): envía la cola, calcula totales por medio de pago, cierra el
 * turno en la nube y descarga el respaldo. Sin conexión no se cierra: las ventas siguen a salvo
 * en el dispositivo y el turno queda abierto hasta poder enviarlas.
 */
export async function closeShift(): Promise<CloseResult> {
  const shift = await currentShift();
  if (!shift) throw new Error("No hay un turno abierto en este equipo.");

  await synchronizePendingOperations();
  const summary = await shiftSummary(shift);
  const refreshed = await currentShift();

  if (!navigator.onLine || !refreshed?.persisted) {
    return { closed: false, summary, reason: "Para cerrar el turno hace falta conexión. Las ventas siguen guardadas en este equipo." };
  }
  if (summary.pendingSync > 0) {
    return {
      closed: false,
      summary,
      reason: `Quedan ${summary.pendingSync} venta(s) sin enviar. Revisá la conexión y probá de nuevo; no se perdió nada.`
    };
  }

  const expectedCash = shift.initialBalance + summary.byMethod.cash.total;
  const { error } = await getSupabase()
    .from("cash_shifts")
    .update({ status: "closed", closed_at: new Date().toISOString(), final_balance: expectedCash })
    .eq("id", shift.id);
  if (error) return { closed: false, summary, reason: `No se pudo cerrar el turno: ${error.message}` };

  let backupError: string | undefined;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await backupService.downloadBackup(`cierre_${shift.registerName}_${stamp}.json`);
  } catch (error) {
    backupError = error instanceof Error ? error.message : "No se pudo generar el respaldo.";
  }

  await writeSetting(SHIFT_KEY, undefined);
  return { closed: true, summary, expectedCash, ...(backupError ? { backupError } : {}) };
}
