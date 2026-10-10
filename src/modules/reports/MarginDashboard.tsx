import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, EmptyState, Message } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { pricePerKiloFromGram } from "../catalog/scalePricing";
import { grossMarginPercentage, latestLotCost, marginTone } from "./marginCalculations";

type MarginRow = {
  id: string;
  productName: string;
  presentationName: string;
  cost: number;
  price: number;
  profit: number;
  marginPercentage: number;
  /** Balanza (ADR-001): costo y precio por gramo; se muestran por kilo. */
  soldByWeight: boolean;
};

export function MarginDashboard() {
  const [margins, setMargins] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMargins = async () => {
    setLoading(true);
    const sb = getSupabase();
    
    // Obtener todas las presentaciones con su precio de venta
    // y cruzarlas con los lotes cerrados (o abiertos) para ver su costo.
    const { data: presentations, error: presErr } = await sb
      .from("product_presentations")
      .select("id, name, sale_price, sold_by_weight, product_id, products(name)");

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
        productName: pres.products?.name ?? "",
        presentationName: pres.name,
        cost,
        price,
        profit,
        marginPercentage,
        soldByWeight: Boolean(pres.sold_by_weight)
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

  const money = (value: number, byWeight: boolean) =>
    byWeight ? `${formatMoney(pricePerKiloFromGram(value))}/kg` : formatMoney(value);

  return (
    <section className="carta carta--sin-relleno" aria-label="Márgenes por presentación">
      <div className="carta__cabecera">
        <p className="cuerpo-s suave">
          Ganancia bruta y margen sobre el precio de venta base de cada presentación, con el costo del lote más reciente.
          De menor a mayor margen: arriba, lo que conviene revisar.
        </p>
      </div>
      {error && <div className="relleno"><Message tone="error">{error}</Message></div>}
      {loading ? (
        <div className="relleno pila pila--s" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="esqueleto" />)}</div>
      ) : margins.length === 0 ? (
        <EmptyState title="Sin datos" icon="percent">No hay lotes con costo de compra registrado.</EmptyState>
      ) : (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Presentación</th>
                <th className="num">Último costo</th>
                <th className="num">Precio de venta</th>
                <th className="num">Ganancia bruta</th>
                <th className="num">Margen bruto</th>
              </tr>
            </thead>
            <tbody>
              {margins.map((m) => (
                <tr key={m.id}>
                  <td className="fuerte">{m.productName}</td>
                  <td className="suave">{m.presentationName}</td>
                  <td className="num">{money(m.cost, m.soldByWeight)}</td>
                  <td className="num">{money(m.price, m.soldByWeight)}</td>
                  <td className={m.profit < 0 ? "num margen--negativo" : "num"}>{money(m.profit, m.soldByWeight)}</td>
                  <td className="num">
                    <Badge tone={marginTone(m.marginPercentage)}>{m.marginPercentage.toFixed(1).replace(".", ",")} %</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
