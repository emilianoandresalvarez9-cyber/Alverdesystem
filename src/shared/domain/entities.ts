export type AppRole = "administrator" | "employee";
export type BaseUnit = "gram" | "millilitre" | "unit";
export type PaymentMethod = "cash" | "transfer" | "qr" | "credit";
export type StockMovementKind = "receipt" | "sale" | "portioning" | "waste" | "adjustment" | "discard";

export type Product = {
  id: string;
  name: string;
  manufacturerBarcode: string | null;
  brandId: string | null;
  categoryId: string | null;
  baseUnit: BaseUnit;
  priceMultiplier: number | null;
  openShelfLifeDays: number | null;
  labelText: string | null;
  active: boolean;
};

export type ProductPresentation = {
  id: string;
  productId: string;
  name: string;
  baseQuantity: number;
  internalBarcode: string | null;
  salePrice: number;
  active: boolean;
};

export type StockLot = {
  id: string;
  presentationId: string;
  supplierId: string | null;
  initialQuantity: number;
  currentQuantity: number;
  purchaseCost: number;
  receivedAt: string;
  manufacturerExpiryDate: string | null;
  openedAt: string | null;
  portionedAt: string | null;
  status: "open" | "closed";
};
