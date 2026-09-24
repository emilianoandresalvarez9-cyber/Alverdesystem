import type { SupabaseAny } from "../../shared/types";
import { useState, useEffect } from "react";
import { GlassCard, SelectField, EmptyState, Button } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { exportToExcel } from "../../shared/export/excel";
import { SalesHistory } from "./SalesHistory";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

interface SalesData {
  date: string;
  total: number;
}

interface ProductRanking {
  name: string;
  quantity: number;
  revenue: number;
}

interface CategoryDemand {
  name: string;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF'];

export function ReportsDashboard() {
  const [salesByDay, setSalesByDay] = useState<SalesData[]>([]);
  const [productRanking, setProductRanking] = useState<ProductRanking[]>([]);
  const [categoryDemand, setCategoryDemand] = useState<CategoryDemand[]>([]);
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      const sb = getSupabase();
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const { data: sales } = await sb
        .from('sales')
        .select('occurred_at, total_amount')
        .gte('occurred_at', startDate.toISOString())
        .order('occurred_at', { ascending: true });

      const salesMap = new Map<string, number>();
      if (sales) {
        sales.forEach((sale: SupabaseAny) => {
          const day = new Date(sale.occurred_at).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
          salesMap.set(day, (salesMap.get(day) || 0) + Number(sale.total_amount));
        });
      }
      setSalesByDay(Array.from(salesMap.entries()).map(([date, total]) => ({ date, total })));

      const { data: saleItems } = await sb
        .from('sale_items')
        .select(`
          quantity, 
          subtotal,
          products ( name, category_id )
        `); // Simplified without date filter for simplicity, could join on sales

      const prodMap = new Map<string, { q: number, r: number, cat: string }>();
      if (saleItems) {
        saleItems.forEach((item: SupabaseAny) => {
          if (!item.products) return;
          const pName = Array.isArray(item.products) ? item.products[0].name : item.products.name;
          const pCat = Array.isArray(item.products) ? item.products[0].category_id : item.products.category_id;
          
          const current = prodMap.get(pName) || { q: 0, r: 0, cat: pCat };
          prodMap.set(pName, { 
            q: current.q + Number(item.quantity), 
            r: current.r + Number(item.subtotal),
            cat: pCat
          });
        });
      }

      const ranking = Array.from(prodMap.entries())
        .map(([name, data]) => ({ name, quantity: data.q, revenue: data.r }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setProductRanking(ranking);

      const catMap = new Map<string, number>();
      Array.from(prodMap.values()).forEach(data => {
        if (!data.cat) return;
        catMap.set(data.cat, (catMap.get(data.cat) || 0) + data.r);
      });
      
      const { data: categories } = await sb.from('categories').select('id, name');
      const catNameMap = new Map<string, string>(categories?.map((c: SupabaseAny) => [c.id, c.name]) || []);

      const catDemand: CategoryDemand[] = Array.from(catMap.entries())
        .map(([id, value]) => ({ name: catNameMap.get(id) || 'Sin Rubro', value }))
        .sort((a, b) => b.value - a.value);
      setCategoryDemand(catDemand);

      setLoading(false);
    }

    loadReports();
  }, [dateRange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-l)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Reportes y Análisis</h2>
        <SelectField 
          label="Rango de tiempo" 
          value={dateRange} 
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </SelectField>
      </div>

      {loading ? (
        <EmptyState title="Cargando reportes..." />
      ) : (
        <div className="dashboard-grid">
          <div style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}><SalesHistory /></div>
          <GlassCard style={{ gridColumn: "1 / -1" }}>
            <h3>Ventas Diarias</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="var(--texto-secundario)" />
                  <YAxis stroke="var(--texto-secundario)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--fondo-oscuro)', border: 'none', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="total" name="Recaudación ($)" stroke="var(--primario-hover)" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <h3>Top 10 Productos Más Vendidos</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={productRanking} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                  <XAxis type="number" stroke="var(--texto-secundario)" />
                  <YAxis dataKey="name" type="category" stroke="var(--texto-secundario)" width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--fondo-oscuro)', border: 'none', borderRadius: 8 }} />
                  <Bar dataKey="revenue" name="Ingresos ($)" fill="var(--secundario-base)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <h3>Demanda por Rubro</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryDemand}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {categoryDemand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--fondo-oscuro)', border: 'none', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
