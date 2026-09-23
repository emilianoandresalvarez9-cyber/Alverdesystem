import React, { useState } from 'react';
import { GlassCard, TextField, Button, Badge } from '../../shared/ui';
import type { Customer } from './types';
import { CustomerCreditModal } from './CustomerCreditModal';

// Mock data for initial rendering
const mockCustomers: Customer[] = [
  { id: '1', name: 'Juan Prez', current_credit: 1500.5, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), phone: '555-0101' },
  { id: '2', name: 'Mara Lpez', current_credit: 0, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), phone: '555-0102' },
];

export const CustomersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const handleOpenCredit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCreditUpdate = (amount: number, type: 'charge' | 'payment') => {
    if (!selectedCustomer) return;
    const change = type === 'charge' ? amount : -amount;
    
    setCustomers(prev => prev.map(c => 
      c.id === selectedCustomer.id ? { ...c, current_credit: c.current_credit + change } : c
    ));
  };

  return (
    <div className="customers-page">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Clientes y Fiado</h1>
        <Button onClick={() => {}}>Nuevo Cliente</Button>
      </header>

      <GlassCard style={{ padding: '24px', marginBottom: '24px' }}>
        <TextField
          label="Buscar cliente"
          placeholder="Nombre o telfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </GlassCard>

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {filteredCustomers.map(customer => (
          <GlassCard key={customer.id} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{customer.name}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>{customer.phone || 'Sin telfono'}</p>
              </div>
              <Badge tone={customer.status === 'active' ? 'exito' : 'error'}>
                {customer.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            
            <div style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Saldo Fiado</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: customer.current_credit > 0 ? 'var(--text-critical)' : 'var(--text-positive)' }}>
                ${customer.current_credit.toFixed(2)}
              </p>
            </div>

            <Button variant="secundario" onClick={() => handleOpenCredit(customer)}>
              Gestionar Fiado / Abonos
            </Button>
          </GlassCard>
        ))}
      </div>

      {selectedCustomer && (
        <CustomerCreditModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          customer={selectedCustomer}
          onUpdate={handleCreditUpdate}
        />
      )}
    </div>
  );
};
