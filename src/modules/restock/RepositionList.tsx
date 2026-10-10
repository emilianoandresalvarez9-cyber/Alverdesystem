import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, GlassCard, Badge, EmptyState } from "../../shared/ui";
import { preferredSupplier } from "./preferredSupplier";
import type { MissingItem } from "./types";
import { useBranch } from "../../shared/branch/BranchContext";

interface RepositionListProps {
  refreshTrigger?: number;
  onResolve?: () => void;
}

export function RepositionList({ refreshTrigger, onResolve }: RepositionListProps) {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // RF-70: faltantes de la sucursal de trabajo; la administradora puede verlos todos juntos.
  const { workingBranchId, isAdmin, filterId, branches } = useBranch();
  const showBranch = isAdmin && filterId === null && branches.length > 1;

  const fetchMissingItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("missing_items")
        .select(`
          id, product_id, reported_by, note, resolved, created_at, branch_id, branch:branches(name),
            product:products(
              id, name, manufacturer_barcode, base_unit,
            supplier_products(
              is_primary,
              supplier:suppliers(id, name, contact)
            )
          )
        `)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (workingBranchId) query = query.eq("branch_id", workingBranchId);
      const { data, error: err } = await query;

      if (err) throw err;

      const mapped: MissingItem[] = (data ?? []).map((row) => {
        const prod = row.product;
        const productSupplier = preferredSupplier(prod?.supplier_products ?? []);

        return {
          id: row.id,
          product_id: row.product_id,
          reported_by: row.reported_by,
          note: row.note,
          resolved: row.resolved,
          created_at: row.created_at,
          branch_id: row.branch_id,
          branch_name: row.branch?.name ?? null,
          product: prod ? {
            id: prod.id,
            name: prod.name,
            manufacturer_barcode: prod.manufacturer_barcode,
            base_unit: prod.base_unit,
          } : undefined,
          supplier: productSupplier,
        };
      });

      setItems(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar reposiciones");
    } finally {
      setLoading(false);
    }
  }, [workingBranchId]);

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
      setError(e instanceof Error ? `No se pudo marcar como resuelto: ${e.message}` : "No se pudo marcar como resuelto.");
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
                    <div style={{ fontWeight: 700 }}>
                      {item.product?.name ?? "Producto desconocido"}
                      {showBranch && item.branch_name && <> <Badge tone="neutro">{item.branch_name}</Badge></>}
                    </div>
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
