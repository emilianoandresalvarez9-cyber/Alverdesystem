export type OfflineOperationKind = "sale" | "stock_movement" | "credit_movement";

export type QueuedOperation<TPayload = Record<string, unknown>> = {
  localId: string;
  deviceId: string;
  kind: OfflineOperationKind;
  payload: TPayload;
  createdAt: string;
  syncedAt?: string;
  failedAt?: string;
  failureMessage?: string;
};

export type NewQueuedOperation<TPayload = Record<string, unknown>> = Omit<
  QueuedOperation<TPayload>,
  "localId" | "deviceId" | "createdAt" | "syncedAt" | "failedAt" | "failureMessage"
>;

export type CatalogSnapshot = {
  refreshedAt: string;
  rows: unknown[];
};
