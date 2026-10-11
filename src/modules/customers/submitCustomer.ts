import { createCustomer, CustomerCreateError } from "./api";

export type NewCustomerForm = { name: string; phone: string; limit: string };

/** Resultado del envío del formulario: el modal solo se cierra con `created`. */
export type SubmitOutcome =
  | { status: "created"; localId: string }
  | { status: "failed"; message: string; retryLocalId?: string };

/**
 * Decide qué pasa al enviar "Nuevo cliente" (RF-45, RF-47). El tope solo viaja si lo carga la
 * administradora; para el resto de los roles la base además lo rechaza (guard_customer_admin_fields).
 * Si falla, se devuelve el localId para reintentar sin generar un segundo ID.
 */
export async function submitNewCustomer(form: NewCustomerForm, isAdmin: boolean, retryLocalId?: string): Promise<SubmitOutcome> {
  try {
    const creditLimit = isAdmin && form.limit.trim() ? Number(form.limit.replace(",", ".")) : null;
    const localId = await createCustomer({ name: form.name, phone: form.phone, creditLimit }, retryLocalId);
    return { status: "created", localId };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "No se pudo crear el cliente.",
      ...(error instanceof CustomerCreateError ? { retryLocalId: error.localId } : {})
    };
  }
}
