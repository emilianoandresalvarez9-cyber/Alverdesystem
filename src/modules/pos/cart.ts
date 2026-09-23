import { lineSubtotal, roundQuantity, sumMoney } from "./money";
import type { CartLine, PaymentMethod, PosEntry, SalePayload } from "./types";

export type CartAction =
  | { type: "add"; entry: PosEntry; lineId: string }
  | { type: "addWeighed"; entry: PosEntry; weight: number; lineId: string }
  | { type: "setQuantity"; lineId: string; quantity: number }
  | { type: "remove"; lineId: string }
  | { type: "clear" };

/**
 * Carrito de caja. Los productos por unidad se agrupan en una línea; cada pesada es una línea
 * propia (se pesan por separado y el importe depende del peso).
 */
export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      if (action.entry.soldByWeight) return lines;
      const existing = lines.find((line) => line.entry.presentationId === action.entry.presentationId && line.weight === undefined);
      if (existing) {
        return lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...lines, { lineId: action.lineId, entry: action.entry, quantity: 1 }];
    }
    case "addWeighed": {
      if (!(action.weight > 0)) return lines;
      const quantity = roundQuantity(action.weight / action.entry.baseQuantity);
      if (quantity <= 0) return lines;
      return [...lines, { lineId: action.lineId, entry: action.entry, quantity, weight: action.weight }];
    }
    case "setQuantity": {
      if (!(action.quantity > 0)) return lines.filter((line) => line.lineId !== action.lineId);
      return lines.map((line) =>
        line.lineId === action.lineId && line.weight === undefined
          ? { ...line, quantity: Math.floor(action.quantity) }
          : line
      );
    }
    case "remove":
      return lines.filter((line) => line.lineId !== action.lineId);
    case "clear":
      return [];
  }
}

export function lineTotal(line: CartLine): number {
  return lineSubtotal(line.quantity, line.entry.salePrice);
}

export function cartTotal(lines: CartLine[]): number {
  return sumMoney(lines.map(lineTotal));
}

/** Arma el cuerpo de la venta con la misma cantidad y precio que se mostraron en pantalla. */
export function buildSalePayload(
  lines: CartLine[],
  options: { shiftId: string; paymentMethod: PaymentMethod; customerId?: string; newId: () => string }
): SalePayload {
  if (lines.length === 0) throw new Error("La venta no tiene productos.");
  if (options.paymentMethod === "credit" && !options.customerId) {
    throw new Error("Elegí el cliente para registrar el fiado.");
  }
  return {
    shiftId: options.shiftId,
    paymentMethod: options.paymentMethod,
    ...(options.customerId ? { customerId: options.customerId } : {}),
    totalAmount: cartTotal(lines),
    items: lines.map((line) => ({
      localId: options.newId(),
      presentationId: line.entry.presentationId,
      quantity: roundQuantity(line.quantity),
      unitPrice: line.entry.salePrice
    }))
  };
}
