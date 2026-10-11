export type OfflineOperationKind = "sale" | "stock_movement" | "credit_movement" | "missing_item" | "customer";

export type QueuedOperation<TPayload = Record<string, unknown>> = {
  localId: string;
  deviceId: string;
  kind: OfflineOperationKind;
  payload: TPayload;
  createdAt: string;
  syncedAt?: string;
  failedAt?: string;
  failureMessage?: string;
  failureCode?: string;
  /** false cuando Supabase devolvió un rechazo permanente; sólo se reintenta por acción explícita. */
  retryable?: boolean;
};

export type NewQueuedOperation<TPayload = Record<string, unknown>> = Omit<
  QueuedOperation<TPayload>,
  "localId" | "deviceId" | "createdAt" | "syncedAt" | "failedAt" | "failureMessage"
>;

export type CatalogSnapshot = {
  refreshedAt: string;
  rows: unknown[];
};
