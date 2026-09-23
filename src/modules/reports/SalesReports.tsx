import { useState, useEffect } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { GlassCard } from "../../shared/ui";

export function SalesReports() {
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    const supabase = getSupabase();
    // En Fase 4, agregamos vistas materializadas, por ahora hacemos select directo
    const { data } = await supabase.from('sales').select('*, sale_items(*)').eq('status', 'completed');
    setSales(data || []);
  }

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount), 0);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Reportes y Análisis (Agente M)</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <GlassCard>
          <h2>Ingresos Totales (Histórico)</h2>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}></p>
          <p style={{ color: 'var(--color-tinta-suave)' }}>Se recalcula automáticamente al cargar nuevas ventas (RF-62).</p>
        </GlassCard>
        
        <GlassCard>
          <h2>Ventas Recientes</h2>
          {sales.slice(0, 5).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <span>{new Date(s.created_at).toLocaleDateString()}</span>
              <span><strong></strong> ({s.payment_method})</span>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}
