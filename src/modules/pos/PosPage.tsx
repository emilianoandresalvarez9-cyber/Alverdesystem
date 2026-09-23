import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button, TextField, SelectField, Badge, Tag, EmptyState } from '../../shared/ui';
import { usePosCart } from './usePosCart';
import type { SalePayload } from './types';

export function PosPage() {
  const { items, removeItem, updateQuantity, addByBarcode, total, clearCart, generatePayload } = usePosCart();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePayload['paymentMethod']>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [manualWeightInput, setManualWeightInput] = useState<{ [id: string]: string }>({});

  const barcodeBuffer = useRef<string>('');
  const timeoutRef = useRef<number | null>(null);

  // RF-18: Manejo de teclado cuña para lector de barras
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          addByBarcode(barcodeBuffer.current);
          barcodeBuffer.current = '';
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = window.setTimeout(() => {
          barcodeBuffer.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [addByBarcode]);

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      addByBarcode(barcodeInput.trim());
      setBarcodeInput('');
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    
    const payload = generatePayload(
      paymentMethod,
      parseFloat(cashAmount) || 0,
      parseFloat(cardAmount) || 0
    );
    
    console.log('Procesando venta:', payload);
    alert('Venta procesada con éxito');
    clearCart();
    setCashAmount('');
    setCardAmount('');
    setPaymentMethod('cash');
  };

  const handleWeightChange = (id: string, weightStr: string) => {
    setManualWeightInput(prev => ({ ...prev, [id]: weightStr }));
    const weight = parseFloat(weightStr);
    if (!isNaN(weight) && weight > 0) {
      updateQuantity(id, weight);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem', height: '100%', maxHeight: '100vh' }}>
      <GlassCard style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Punto de Venta (Caja)</h2>
          <Badge tone="exito">Caja Abierta</Badge>
        </div>

        <form onSubmit={handleManualBarcodeSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <TextField
              label="Código de barras manual"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanear o ingresar código..."
            />
          </div>
          <Button type="submit" variant="secundario">Agregar</Button>
        </form>
        <p style={{ fontSize: '0.75rem', color: '#666' }}>
          * El escáner de cuña está activo en segundo plano (RF-18).
        </p>

        <div style={{ flex: 1, overflowY: 'auto', marginTop: '1rem' }}>
          {items.length === 0 ? (
            <EmptyState title="Carrito vacío">
              Pase un producto por el lector o ingrese su código manualmente.
            </EmptyState>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item) => (
                <li key={item.id} style={{ padding: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 0.25rem' }}>{item.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', margin: '0 0 0.5rem' }}>
                      ${item.price.toFixed(2)} {item.weightManual ? '/ kg' : 'c/u'}
                    </p>
                    {item.barcode && <Tag>EAN: {item.barcode}</Tag>}
                  </div>
                  
                  <div style={{ width: '120px', margin: '0 1rem' }}>
                    {/* RF-33: Peso manual */}
                    {item.weightManual ? (
                      <TextField
                        type="number"
                        label="Peso (kg)"
                        step="0.001"
                        value={manualWeightInput[item.id] ?? item.quantity}
                        onChange={(e) => handleWeightChange(item.id, e.target.value)}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Button
                          variant="secundario"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </Button>
                        <span style={{ width: '2rem', textAlign: 'center' }}>{item.quantity}</span>
                        <Button
                          variant="secundario"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                    )}
                  </div>

                  <div style={{ width: '80px', textAlign: 'right', fontWeight: 'bold', margin: '0 1rem' }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  
                  <Button variant="peligro" onClick={() => removeItem(item.id)}>X</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassCard>

      <GlassCard style={{ width: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Resumen de Venta</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', padding: '1rem 0', borderBottom: '1px solid #eee' }}>
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <SelectField
          label="Método de Pago"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as SalePayload['paymentMethod'])}
        >
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta / Transferencia</option>
          <option value="mixed">Cobro Mixto</option>
          <option value="fiado">Fiado (Cuenta Corriente)</option>
        </SelectField>

        {paymentMethod === 'mixed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '0.5rem' }}>
            <TextField
              label="Monto en Efectivo"
              type="number"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
            />
            <TextField
              label="Monto en Tarjeta"
              type="number"
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
            />
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Button
            variant="primario"
            onClick={handleCheckout}
            disabled={items.length === 0}
            style={{ padding: '1rem', fontSize: '1.125rem' }}
          >
            Cobrar e Imprimir
          </Button>
          <Button variant="fantasma" onClick={clearCart} disabled={items.length === 0}>
            Cancelar Venta
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
