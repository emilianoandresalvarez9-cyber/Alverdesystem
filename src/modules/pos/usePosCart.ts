import { useState, useCallback } from 'react';
import type { CartItem, SalePayload } from './types';

export function usePosCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
    );
  }, [removeItem]);

  const addByBarcode = useCallback((barcode: string) => {
    // Mock product resolution based on barcode
    // RF-33: Support for weighted items. Conventionally barcodes starting with 20 are weighted
    const isWeighted = barcode.startsWith('20');
    
    const newItem: CartItem = {
      id: barcode,
      barcode: barcode,
      name: `Producto ${barcode}`,
      price: isWeighted ? 1500.0 : 100.0,
      quantity: 1,
      weightManual: isWeighted
    };
    addItem(newItem);
  }, [addItem]);

  const total = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const generatePayload = useCallback(
    (paymentMethod: SalePayload['paymentMethod'], cashAmount?: number, cardAmount?: number, clientId?: string): SalePayload => {
      return {
        items,
        total,
        paymentMethod,
        cashAmount,
        cardAmount,
        clientId,
      };
    },
    [items, total]
  );

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    addByBarcode,
    total,
    clearCart,
    generatePayload,
  };
}
