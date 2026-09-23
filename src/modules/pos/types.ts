/** Medios de pago: exactamente los valores del enum `payment_method` de la base. */
export type PaymentMethod = "cash" | "transfer" | "qr" | "credit";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "transfer", "qr", "credit"];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  credit: "Fiado"
};

/** Una presentación vendible, tal como la ve la caja (sin costos: RNF-04). */
export interface PosEntry {
  presentationId: string;
  productId: string;
  productName: string;
  presentationName: string;
  baseUnit: "gram" | "millilitre" | "unit";
  baseQuantity: number;
  salePrice: number;
  soldByWeight: boolean;
  internalBarcode: string | null;
  manufacturerBarcode: string | null;
}

export interface CartLine {
  lineId: string;
  entry: PosEntry;
  /** En unidades de la presentación (ADR-001). Para venta por peso: peso / baseQuantity. */
  quantity: number;
  /** Peso ingresado en la unidad base (g o ml), solo para ventas por peso. */
  weight?: number;
}

export interface SaleItemPayload {
  localId: string;
  presentationId: string;
  quantity: number;
  unitPrice: number;
}

/** Cuerpo de la operación `sale` de la cola offline; lo consume process_offline_sale. */
export interface SalePayload {
  shiftId: string;
  paymentMethod: PaymentMethod;
  customerId?: string;
  totalAmount: number;
  items: SaleItemPayload[];
}

export interface CurrentShift {
  id: string;
  registerId: string;
  registerName: string;
  openedAt: string;
  initialBalance: number;
  /** false mientras el turno se abrió sin conexión y todavía no existe en la nube. */
  persisted: boolean;
}
