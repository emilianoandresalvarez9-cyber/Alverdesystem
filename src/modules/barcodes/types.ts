export interface Ean13ValidationResult {
  valid: boolean;
  code: string;
  checkDigit?: number;
  calculatedCheckDigit?: number;
  isInternalRange?: boolean;
  reason?: string;
}

export interface BulkPresentationItem {
  productId: string;
  productName: string;
  presentationId: string;
  presentationName: string;
  internalBarcode: string | null;
  manufacturerBarcode: string | null;
  categoryName: string;
  baseUnit: "gram" | "millilitre" | "unit";
  baseQuantity: number;
  salePrice: number;
}

export interface BarcodeScanLookup {
  found: boolean;
  barcode: string;
  isBulk: boolean;
  product?: {
    id: string;
    name: string;
    baseUnit: string;
  };
  presentation?: {
    id: string;
    name: string;
    baseQuantity: number;
    internalBarcode: string | null;
    salePrice: number;
  };
  message?: string;
}

export interface BarcodeRenderOptions {
  width?: number | string;
  height?: number;
  showText?: boolean;
  fontSize?: number;
  barColor?: string;
  bgColor?: string;
}
