import React, { useState } from 'react';
import { Modal, TextField, Button } from '../../shared/ui';
import { Customer } from './types';

interface CustomerCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onUpdate: (amount: number, type: 'charge' | 'payment') => void;
}

export const CustomerCreditModal: React.FC<CustomerCreditModalProps> = ({ isOpen, onClose, customer, onUpdate }) => {
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<'charge' | 'payment'>('payment');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    
    onUpdate(amount, type);
    setAmountStr('');
    setNotes('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gestionar Fiado: ${customer.name}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            type="button" 
            variant={type === 'payment' ? 'primary' : 'secondary'} 
            onClick={() => setType('payment')}
            style={{ flex: 1 }}
          >
            Abono (Paga)
          </Button>
          <Button 
            type="button" 
            variant={type === 'charge' ? 'primary' : 'secondary'} 
            onClick={() => setType('charge')}
            style={{ flex: 1 }}
          >
            Nuevo Fiado
          </Button>
        </div>

        <TextField
          label="Monto ($)"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.00"
        />

        <TextField
          label="Notas (Opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: Pago parcial, compra del viernes..."
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">Confirmar {type === 'payment' ? 'Abono' : 'Fiado'}</Button>
        </div>
      </form>
    </Modal>
  );
};
