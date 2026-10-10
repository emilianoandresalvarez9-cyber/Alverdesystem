import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, Badge, EmptyState, Message } from "../../shared/ui";
import { formatDayTime } from "../../shared/format/date";
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
    const sName = item.supplier?.name ?? "Sin proveedor asignado";
    const sContact = item.supplier?.contact ?? null;
    if (!acc[sName]) {
      acc[sName] = { supplierName: sName, supplierContact: sContact, items: [] };
    }
    acc[sName].items.push(item);
    return acc;
  }, {});

  const supplierGroups = Object.values(grouped);

  return (
    <>
      {error && <Message tone="error">{error}</Message>}

      {loading ? (
        <div className="carta pila pila--s" aria-busy="true"><span className="esqueleto" /><span className="esqueleto" /></div>
      ) : supplierGroups.length === 0 ? (
        <EmptyState title="Sin faltantes pendientes" icon="check_circle">No hay productos marcados como faltantes en este momento.</EmptyState>
      ) : (
        supplierGroups.map((group) => (
          <section key={group.supplierName} className="carta carta--sin-relleno" aria-label={`Faltantes de ${group.supplierName}`}>
            <div className="carta__cabecera">
              <div className="pila reposicion__proveedor">
                <h3 className="titulo-seccion">{group.supplierName}</h3>
                {group.supplierContact && <span className="meta">Contacto: {group.supplierContact}</span>}
              </div>
              <Badge tone="aviso">{group.items.length === 1 ? "1 faltante" : `${group.items.length} faltantes`}</Badge>
            </div>
            <ul className="lista lista--plana">
              {group.items.map((item) => (
                <li key={item.id}>
                  <div className="lista__principal">
                    <span className="lista__titulo">
                      {item.product?.name ?? "Producto desconocido"}
                      {showBranch && item.branch_name ? <span className="suave"> · {item.branch_name}</span> : null}
                    </span>
                    {item.note && <span className="lista__meta">Nota: {item.note}</span>}
                    <span className="lista__meta">Reportado <span className="cifra">{formatDayTime(item.created_at)}</span></span>
                  </div>
                  <Button variant="secundario" size="compacto" icon="check" onClick={() => handleResolve(item.id)}>Marcar resuelto</Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
