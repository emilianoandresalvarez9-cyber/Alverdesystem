import type { SupabaseAny } from "../../shared/types";
import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { GlassCard, Badge, EmptyState } from "../../shared/ui";
import { grossMarginPercentage, latestLotCost, marginTone } from "./marginCalculations";

export function MarginDashboard() {
  const [margins, setMargins] = useState<SupabaseAny[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMargins = async () => {
    setLoading(true);
    const sb = getSupabase();
    
    // Obtener todas las presentaciones con su precio de venta
    // y cruzarlas con los lotes cerrados (o abiertos) para ver su costo.
    const { data: presentations, error: presErr } = await sb
      .from("product_presentations")
      .select("id, name, sale_price, product_id, products(name)");

    if (presErr) {
      setError(presErr.message);
      setLoading(false);
      return;
    }

    const { data: lots, error: lotErr } = await sb
      .from("stock_lots")
      .select("presentation_id, purchase_cost, received_at, portioned_at")
      .order("received_at", { ascending: false });

    if (lotErr) {
      setError(lotErr.message);
      setLoading(false);
      return;
    }

    // Calcular el margen para cada presentación basado en su ÚLTIMO lote
    const marginData = (presentations ?? []).flatMap(pres => {
      const cost = latestLotCost(lots ?? [], pres.id);
      if (cost === null) return [];
      const price = pres.sale_price;
      const profit = price - cost;
      const marginPercentage = grossMarginPercentage(cost, price);

      return {
        id: pres.id,
        productName: Array.isArray(pres.products) ? (pres.products[0] as SupabaseAny)?.name : (pres.products as SupabaseAny)?.name,
        presentationName: pres.name,
        cost,
        price,
        profit,
        marginPercentage
      };
    }); // Un lote más reciente sin costo significa que el margen aún es desconocido.

    // Ordenar por margen (de menor a mayor) para detectar los que dan perdida o poco margen
    marginData.sort((a, b) => a.marginPercentage - b.marginPercentage);

    setMargins(marginData);
    setLoading(false);
  };

  useEffect(() => {
    loadMargins();
  }, []);

  return (
    <GlassCard>
      <h2>Panel de Márgenes</h2>
      <p>Muestra la ganancia bruta y el margen sobre el precio de venta de cada presentación, usando el costo del lote más reciente.</p>
      
      {error && <Badge tone="error" style={{ marginBottom: "1rem" }}>{error}</Badge>}

      {loading ? (
        <p>Calculando márgenes...</p>
      ) : margins.length === 0 ? (
        <EmptyState title="Sin datos">No hay lotes con costo de compra registrado.</EmptyState>
      ) : (
        <table style={{ width: "100%", textAlign: "left", marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Último Costo</th>
              <th>Precio Venta</th>
              <th>Ganancia bruta</th>
              <th>Margen bruto (%)</th>
            </tr>
          </thead>
          <tbody>
            {margins.map(m => (
              <tr key={m.id}>
                <td>{m.productName}</td>
                <td>{m.presentationName}</td>
                <td>${m.cost.toFixed(2)}</td>
                <td>${m.price.toFixed(2)}</td>
                <td style={{ color: m.profit < 0 ? "var(--peligro)" : "var(--exito)" }}>
                  ${m.profit.toFixed(2)}
                </td>
                <td>
                  <Badge tone={marginTone(m.marginPercentage)}>
                    {m.marginPercentage.toFixed(1)}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}
