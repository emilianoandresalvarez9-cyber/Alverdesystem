export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  current_credit: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CustomerCredit {
  id: string;
  customer_id: string;
  amount: number;
  type: 'charge' | 'payment'; // charge = fiado (deuda sube), payment = abono (deuda baja)
  notes?: string;
  created_at: string;
}
