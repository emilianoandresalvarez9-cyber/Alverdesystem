import { useState, useEffect } from "react";
import { GlassCard, SelectField, EmptyState } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { SalesHistory } from "./SalesHistory";
import { toSalesReportLines, buildSalesReport, type SalesReportRow } from "./salesReport";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF'];

export function ReportsDashboard() {
  const [report, setReport] = useState(() => buildSalesReport([]));
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(dateRange));

        const { data, error: queryError } = await getSupabase()
          .from('sale_items')
          .select(`
            quantity,
            unit_price,
            sale:sales!inner(occurred_at, status),
            presentation:product_presentations!inner(
              product:products!inner(id, name, category_id, category:categories(name))
            )
          `)
          .gte('sales.occurred_at', startDate.toISOString())
          .eq('sales.status', 'closed');

        if (queryError) throw queryError;

        const nextReport = buildSalesReport(toSalesReportLines((data ?? []) as unknown as SalesReportRow[]));
        if (!cancelled) setReport(nextReport);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los reportes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReports();
    return () => { cancelled = true; };
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

      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}

      {loading ? (
        <EmptyState title="Cargando reportes..." />
      ) : (
        <div className="dashboard-grid">
          <div style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}><SalesHistory /></div>
          <GlassCard style={{ gridColumn: "1 / -1" }}>
            <h3>Ventas Diarias</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={report.salesByDay}>
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
                <BarChart data={report.productRanking} layout="vertical" margin={{ left: 20 }}>
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
                    data={report.categoryDemand}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {report.categoryDemand.map((entry, index) => (
                      <Cell key={`cell-${entry.categoryId}`} fill={COLORS[index % COLORS.length]} />
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
