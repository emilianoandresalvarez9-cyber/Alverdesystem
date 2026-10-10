import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Sale } from "../../shared/types";
import { Badge, Button, Message, Modal } from "../../shared/ui";
import { useBranch } from "../../shared/branch/BranchContext";
import { formatMoney } from "../pos/money";
import { PAYMENT_LABELS, type PaymentMethod } from "../pos/types";
import { formatDayTime } from "../../shared/format/date";

type SaleRow = Pick<Sale, "id" | "local_id" | "occurred_at" | "total_amount" | "status" | "payment_method">;

const saleCode = (sale: SaleRow) => sale.local_id.slice(0, 8);
const methodLabel = (method: string) => PAYMENT_LABELS[method as PaymentMethod] ?? method;

/**
 * Últimas 50 ventas (RF-37). Anular no se puede deshacer: pide confirmación en un diálogo
 * con la consecuencia escrita. La base devuelve el stock y revierte el fiado (trigger
 * sale_void_return_stock) y sólo la administradora puede anular.
 */
export function SalesHistory() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [error, setError] = useState("");
  const [toVoid, setToVoid] = useState<SaleRow | null>(null);
  const [busy, setBusy] = useState(false);
  // RF-70: ventas de la sucursal elegida, o de todas.
  const { filterId } = useBranch();

  const loadSales = async () => {
    let query = getSupabase()
      .from("sales")
      .select("id, local_id, occurred_at, total_amount, status, payment_method")
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (filterId) query = query.eq("branch_id", filterId);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setSales(data || []);
  };

  useEffect(() => {
    void loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterId]);

  const voidSale = async () => {
    if (!toVoid) return;
    setBusy(true);
    const { error: err } = await getSupabase().from("sales").update({ status: "voided" }).eq("id", toVoid.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      setError("");
    }
    setToVoid(null);
    await loadSales();
  };

  return (
    <section className="carta carta--sin-relleno" aria-labelledby="ultimas-ventas">
      <div className="carta__cabecera"><h3 className="titulo-seccion" id="ultimas-ventas">Últimas 50 ventas</h3></div>
      {error && <div className="relleno"><Message tone="error">{error}</Message></div>}
      {sales.length === 0 ? <p className="meta relleno">Todavía no hay ventas.</p> : (
        <div className="tabla-marco">
          <table className="tabla tabla--compacta">
            <thead>
              <tr><th>Fecha</th><th>ID local</th><th>Método</th><th className="num">Total</th><th>Estado</th><th className="acciones"><span className="sr">Anular</span></th></tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const voided = s.status !== "closed";
                return (
                  <tr key={s.id}>
                    <td className="cifra">{formatDayTime(s.occurred_at)}</td>
                    <td className="cifra" title={s.local_id}>{saleCode(s)}</td>
                    <td>{methodLabel(s.payment_method)}</td>
                    <td className="num fuerte">{formatMoney(Number(s.total_amount))}</td>
                    <td className="ventas__estado">
                      {voided ? <Badge tone="neutro" icon="cancel">Anulada</Badge> : <Badge tone="exito">Cerrada</Badge>}
                    </td>
                    <td className="acciones">
                      <Button variant="peligro" size="compacto" disabled={voided} onClick={() => setToVoid(s)}
                        aria-label={`Anular la venta ${saleCode(s)}`}>Anular</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toVoid && <VoidSaleDialog sale={toVoid} busy={busy} onCancel={() => setToVoid(null)} onConfirm={() => void voidSale()} />}
    </section>
  );
}

/** Confirmación de Anular: la pregunta en el título, la consecuencia escrita y la acción en peligro relleno. */
export function VoidSaleDialog({ sale, busy, onCancel, onConfirm }: {
  sale: SaleRow; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open title={`¿Anular la venta ${saleCode(sale)}?`} onClose={onCancel}
      subtitle={<>{formatDayTime(sale.occurred_at)} · {methodLabel(sale.payment_method)} · <span className="cifra">{formatMoney(Number(sale.total_amount))}</span></>}
      footer={<>
        <Button variant="fantasma" onClick={onCancel}>Cancelar</Button>
        <Button variant="peligro" confirmar loading={busy} onClick={onConfirm}>Anular venta</Button>
      </>}>
      <Message tone="error">Anular una venta no se puede deshacer. El stock vuelve a los lotes y, si fue fiada, se descuenta de la cuenta del cliente.</Message>
    </Modal>
  );
}
