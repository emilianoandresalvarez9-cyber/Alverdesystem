import type { SupabaseAny } from "../../shared/types";
import { useState, useEffect } from "react";
import { GlassCard, Button, TextField, Badge } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { validateShelfLifeDays } from "./fractioningLogic";

interface ShelfLifeProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  open_shelf_life_days: number | null;
}

export function ShelfLifeManager() {
  const [products, setProducts] = useState<ShelfLifeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays] = useState("");
  
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("products")
        .select(`
          id, name, open_shelf_life_days,
          brand:brands(name),
          category:categories(name)
        `)
        .eq("active", true)
        .order("name");

      if (err) throw err;
      
      const mapped = (data || []).map((p: SupabaseAny) => ({
        id: p.id,
        name: p.name,
        brand: p.brand?.name || null,
        category: p.category?.name || null,
        open_shelf_life_days: p.open_shelf_life_days,
      }));
      setProducts(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const applyBulkUpdate = async (clear: boolean = false) => {
    if (selectedIds.size === 0) return;
    
    let days: number | null = null;
    if (!clear) {
      days = parseInt(bulkDays, 10);
      if (!validateShelfLifeDays(days)) {
        console.log("Ingresá un número válido de días mayor a 0.");
        return;
      }
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      
      const { error: err } = await supabase
        .from("products")
        .update({ open_shelf_life_days: days })
        .in("id", Array.from(selectedIds));

      if (err) throw err;
      
      // Actualizamos localmente para no hacer refetch si no queremos
      setProducts(prev => prev.map(p => 
        selectedIds.has(p.id) ? { ...p, open_shelf_life_days: days } : p
      ));
      
      setSelectedIds(new Set());
      setBulkDays("");
      console.log(`Vida útil ${clear ? "borrada" : "asignada"} a ${selectedIds.size} producto(s).`);
    } catch (e) {
      console.log(e instanceof Error ? `Error: ${e.message}` : "Error aplicando vida útil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard>
      <header style={{ marginBottom: "var(--esp-m)" }}>
        <h2 style={{ margin: "0 0 var(--esp-xs)" }}>Vida Útil tras Apertura (RF-17 / RF-17b)</h2>
        <p style={{ margin: 0, color: "var(--color-tinta-suave)", fontSize: "var(--texto-s)" }}>
          Asigná de forma masiva los días de vencimiento que corren luego de abrir una bolsa.
        </p>
      </header>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      {/* Barra de Herramientas Masiva */}
      <div style={{ display: "flex", gap: "var(--esp-m)", alignItems: "flex-end", marginBottom: "var(--esp-l)", flexWrap: "wrap", padding: "var(--esp-s)", background: "var(--glass-fondo-lite)", borderRadius: "var(--radio-panel)" }}>
        <TextField
          label="Buscar producto, marca o rubro"
          placeholder="Ej: Lentejas, El Portugues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 250 }}
        />
        
        <div style={{ width: "1px", background: "var(--glass-borde)", height: 40, margin: "0 var(--esp-s)" }}></div>

        <TextField
          label="Días tras apertura"
          type="number"
          min="1"
          placeholder="Ej: 90"
          value={bulkDays}
          onChange={(e) => setBulkDays(e.target.value)}
          style={{ width: 120 }}
          disabled={selectedIds.size === 0}
        />
        <Button 
          variant="primario" 
          onClick={() => applyBulkUpdate(false)}
          disabled={selectedIds.size === 0 || !bulkDays}
        >
          Aplicar a {selectedIds.size} selec.
        </Button>
        <Button 
          variant="fantasma" 
          onClick={() => applyBulkUpdate(true)}
          disabled={selectedIds.size === 0}
        >
          Limpiar (N/A)
        </Button>
      </div>

      <div className="table-wrap glass">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>
                <input 
                  type="checkbox" 
                  checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                  onChange={toggleAll}
                  disabled={filteredProducts.length === 0}
                />
              </th>
              <th>Producto</th>
              <th>Marca</th>
              <th>Vida Útil Actual</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center" }}>Cargando productos...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center" }}>No hay productos que coincidan.</td></tr>
            ) : (
              filteredProducts.map(p => (
                <tr key={p.id} style={{ opacity: selectedIds.has(p.id) ? 1 : 0.85 }}>
                  <td style={{ textAlign: "center" }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelection(p.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.brand || "—"}</td>
                  <td>
                    {p.open_shelf_life_days ? (
                      <Badge tone="exito">{p.open_shelf_life_days} días</Badge>
                    ) : (
                      <Badge tone="neutro">Sin asignar</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
