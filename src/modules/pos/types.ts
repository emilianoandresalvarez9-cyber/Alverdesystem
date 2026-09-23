export interface CartItem {
  id: string; // product id or barcode
  barcode?: string;
  name: string;
  price: number;
  quantity: number;
  weightManual?: boolean;
}

export interface SalePayload {
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'mixed' | 'fiado';
  cashAmount?: number;
  cardAmount?: number;
  clientId?: string;
}
