import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, GlassCard, Badge, EmptyState } from "../../shared/ui";
import type { MissingItem } from "./types";

interface RepositionListProps {
  refreshTrigger?: number;
  onResolve?: () => void;
}

export function RepositionList({ refreshTrigger, onResolve }: RepositionListProps) {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissingItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("missing_items")
        .select(`
          id, product_id, reported_by, note, resolved, created_at,
          product:products(
            id, name, manufacturer_barcode, base_unit,
            supplier_products(
              is_preferred,
              supplier:suppliers(id, name, contact)
            )
          )
        `)
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const mapped: MissingItem[] = (data ?? []).map((row: any) => {
        const prod = row.product;
        let preferredSupplier = null;
        if (prod?.supplier_products && prod.supplier_products.length > 0) {
          const pref = prod.supplier_products.find((sp: any) => sp.is_preferred);
          preferredSupplier = pref?.supplier ?? prod.supplier_products[0]?.supplier ?? null;
        }

        return {
          id: row.id,
          product_id: row.product_id,
          reported_by: row.reported_by,
          note: row.note,
          resolved: row.resolved,
          created_at: row.created_at,
          product: prod ? {
            id: prod.id,
            name: prod.name,
            manufacturer_barcode: prod.manufacturer_barcode,
            base_unit: prod.base_unit,
          } : undefined,
          supplier: preferredSupplier,
        };
      });

      setItems(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar reposiciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissingItems();
  }, [fetchMissingItems, refreshTrigger]);

  const handleResolve = async (itemId: string) => {
    try {
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from("missing_items")
        .update({ resolved: true })
        .eq("id", itemId);

      if (updateErr) throw updateErr;

      setItems(prev => prev.filter(i => i.id !== itemId));
      if (onResolve) onResolve();
    } catch (e) {
      alert(e instanceof Error ? `Error al resolver: ${e.message}` : "Error al resolver faltante");
    }
  };

  const grouped = items.reduce<Record<string, { supplierName: string; supplierContact: string | null; items: MissingItem[] }>>((acc, item) => {
    const sName = item.supplier?.name ?? "Sin Proveedor Asignado";
    const sContact = item.supplier?.contact ?? null;
    if (!acc[sName]) {
      acc[sName] = { supplierName: sName, supplierContact: sContact, items: [] };
    }
    acc[sName].items.push(item);
    return acc;
  }, {});

  const supplierGroups = Object.values(grouped);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}

      {loading ? (
        <GlassCard className="skeleton" style={{ minHeight: 120 }} />
      ) : supplierGroups.length === 0 ? (
        <EmptyState title="Sin faltantes pendientes">
          No hay productos marcados como faltantes en este momento.
        </EmptyState>
      ) : (
        supplierGroups.map((group) => (
          <GlassCard key={group.supplierName}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-borde)", paddingBottom: "var(--esp-s)", marginBottom: "var(--esp-s)" }}>
              <div>
                <h3 style={{ margin: 0 }}>{group.supplierName}</h3>
                {group.supplierContact && (
                  <span style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-suave)" }}>
                    Contacto: {group.supplierContact}
                  </span>
                )}
              </div>
              <Badge tone="aviso">{group.items.length} faltante(s)</Badge>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-s)" }}>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--esp-s)",
                    borderRadius: "var(--radio-control)",
                    background: "var(--glass-fondo-lite)"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.product?.name ?? "Producto desconocido"}</div>
                    {item.note && (
                      <span style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-apagada)" }}>
                        Nota: {item.note}
                      </span>
                    )}
                    <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-apagada)" }}>
                      Reportado: {new Date(item.created_at).toLocaleDateString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <Button variant="secundario" onClick={() => handleResolve(item.id)}>
                    Marcar Resuelto
                  </Button>
                </div>
              ))}
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
