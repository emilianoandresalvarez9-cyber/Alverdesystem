import { useState, useEffect } from "react";
import { Badge, Button, EmptyState, Message, TextField, useCompact } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { validateShelfLifeDays } from "./fractioningLogic";

interface ShelfLifeProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  open_shelf_life_days: number | null;
}

/** Vida útil después de abrir (RF-17, RF-17b): días que corren desde que se abre una bolsa, asignados en masa. */
export function ShelfLifeManager() {
  const [products, setProducts] = useState<ShelfLifeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays] = useState("");
  const compact = useCompact();
  
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
      
      const mapped = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand?.name || null,
        category: p.category?.name || null,
        open_shelf_life_days: p.open_shelf_life_days,
      }));
      setProducts(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los productos.");
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
    setError(null);
    setSuccess(null);
    
    let days: number | null = null;
    if (!clear) {
      days = parseInt(bulkDays, 10);
      if (!validateShelfLifeDays(days)) {
        setError("Ingresá un número válido de días mayor a 0.");
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
      
      setProducts(prev => prev.map(p => 
        selectedIds.has(p.id) ? { ...p, open_shelf_life_days: days } : p
      ));
      
      setSelectedIds(new Set());
      setBulkDays("");
      setSuccess(clear
        ? `Se quitó la vida útil de ${selectedIds.size} producto${selectedIds.size === 1 ? "" : "s"}.`
        : `${days} días después de abrir para ${selectedIds.size} producto${selectedIds.size === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(e instanceof Error ? `No se pudo aplicar la vida útil: ${e.message}` : "No se pudo aplicar la vida útil.");
    } finally {
      setLoading(false);
    }
  };

  const allChecked = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));
  const count = `${selectedIds.size} producto${selectedIds.size === 1 ? "" : "s"}`;
  const daysBadge = (p: ShelfLifeProduct) => p.open_shelf_life_days
    ? <Badge tone="exito" icon={null}>{p.open_shelf_life_days} días</Badge>
    : <Badge tone="neutro">Sin asignar</Badge>;

  return (
    <>
      <section className="carta pila" aria-labelledby="vida-util-titulo">
        <div className="pila pila--s">
          <h3 className="titulo-seccion" id="vida-util-titulo">Vida útil después de abrir</h3>
          <p className="cuerpo-s suave">Cuántos días dura un producto una vez abierta la bolsa. Marcá los productos y asignales los días de una vez.</p>
        </div>
        <div className="form-fila">
          <TextField label="Buscar producto, marca o rubro" icon="search" type="search" placeholder="Ej.: lentejas"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField label="Días después de abrir" type="number" min="1" inputMode="numeric" numeric suffix="días" placeholder="90"
            value={bulkDays} onChange={(e) => setBulkDays(e.target.value)} disabled={selectedIds.size === 0} />
        </div>
        <div className="fila">
          <Button onClick={() => void applyBulkUpdate(false)} disabled={selectedIds.size === 0 || !bulkDays} loading={loading && products.length > 0}>
            Asignar a {count}
          </Button>
          <Button variant="secundario" onClick={() => void applyBulkUpdate(true)} disabled={selectedIds.size === 0 || loading}>
            Quitar la vida útil
          </Button>
        </div>
        {error && <Message tone="error">{error}</Message>}
        {success && <Message tone="exito">{success}</Message>}
      </section>

      {loading && products.length === 0 ? (
        <div className="carta pila pila--s" aria-busy="true" aria-label="Cargando productos…"><span className="esqueleto" /><span className="esqueleto" /></div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState title="Sin productos" icon="search">No hay productos activos que coincidan con la búsqueda.</EmptyState>
      ) : compact ? (
        <ul className="lista" aria-label="Productos">
          <li>
            <label className="casilla crece">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              Marcar los {filteredProducts.length} visibles
            </label>
          </li>
          {filteredProducts.map((p) => (
            <li key={p.id} aria-selected={selectedIds.has(p.id)}>
              <label className="casilla crece vida-util__casilla">
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelection(p.id)} />
                <span className="lista__principal">
                  <span className="lista__titulo">{p.name}</span>
                  {p.brand && <span className="lista__meta">{p.brand}</span>}
                </span>
              </label>
              {daysBadge(p)}
            </li>
          ))}
        </ul>
      ) : (
        <section className="carta carta--sin-relleno" aria-label="Productos">
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead>
                <tr>
                  <th className="vida-util__marca">
                    <label className="casilla">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                      <span className="sr">Marcar los {filteredProducts.length} visibles</span>
                    </label>
                  </th>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th>Vida útil</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} aria-selected={selectedIds.has(p.id)}>
                    <td className="vida-util__marca">
                      <label className="casilla">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelection(p.id)} />
                        <span className="sr">Marcar {p.name}</span>
                      </label>
                    </td>
                    <td className="fuerte">{p.name}</td>
                    <td className={p.brand ? undefined : "apagada"}>{p.brand || "—"}</td>
                    <td>{daysBadge(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
