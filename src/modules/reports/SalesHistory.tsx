import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Sale } from "../../shared/types";
import { GlassCard, Button, Badge } from "../../shared/ui";

export function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSales = async () => {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from('sales')
      .select('id, local_id, occurred_at, total_amount, status, payment_method')
      .order('occurred_at', { ascending: false })
      .limit(50);
      
    if (error) setError(error.message);
    else setSales(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleVoidSale = async (id: string) => {
    
    
    setLoading(true);
    const { error } = await getSupabase()
      .from('sales')
      .update({ status: 'voided' })
      .eq('id', id);
      
    if (error) setError(error.message);
    await loadSales();
  };

  return (
    <GlassCard>
      <h3>Últimas 50 Ventas</h3>
      {error && <Badge tone="error">{error}</Badge>}
      <table style={{ width: "100%", textAlign: "left", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>ID Local</th>
            <th>Método</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(s => (
            <tr key={s.id}>
              <td>{new Date(s.occurred_at).toLocaleString()}</td>
              <td><span title={s.local_id}>{s.local_id.substring(0, 8)}...</span></td>
              <td>{s.payment_method}</td>
              <td>${Number(s.total_amount).toFixed(2)}</td>
              <td>
                <Badge tone={s.status === 'closed' ? "exito" : "error"}>{s.status}</Badge>
              </td>
              <td>
                {s.status === 'closed' && (
                  <Button variant="fantasma" onClick={() => handleVoidSale(s.id)}>Anular</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
