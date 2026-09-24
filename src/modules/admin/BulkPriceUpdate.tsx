import { useState, useEffect } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Product, Presentation, Brand, Category, Sale, SaleItem, StockLot, Customer, Supplier } from "../../shared/types";
import { GlassCard, Button, Badge, TextField, SelectField } from "../../shared/ui";

export function BulkPriceUpdate() {
  const [brands, setBrands] = useState<Brand[]>([]);;
  const [categories, setCategories] = useState<Brand[]>([]);;
  
  const [filterType, setFilterType] = useState<"all" | "brand" | "category">("all");
  const [filterId, setFilterId] = useState("");
  const [percentage, setPercentage] = useState("10"); // +10% por defecto
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sb = getSupabase();

  useEffect(() => {
    async function loadData() {
      const [{ data: bData }, { data: cData }] = await Promise.all([
        sb.from("brands").select("*").order("name"),
        sb.from("categories").select("*").order("name")
      ]);
      setBrands(bData || []);
      setCategories(cData || []);
    }
    loadData();
  }, []);

  const handleUpdate = async () => {
    const p = parseFloat(percentage);
    if (isNaN(p) || p === 0) return setError("Porcentaje inválido");
    
    

    setLoading(true);
    setError("");
    setMessage("Calculando productos afectados...");

    try {
      // 1. Obtener los productos afectados
      let query = sb.from("product_presentations").select("id, sale_price, products!inner(brand_id, category_id)");
      
      if (filterType === "brand" && filterId) {
        query = query.eq("products.brand_id", filterId);
      } else if (filterType === "category" && filterId) {
        query = query.eq("products.category_id", filterId);
      }
      
      const { data: presentations, error: presErr } = await query;
      
      if (presErr) throw new Error(presErr.message);
      if (!presentations || presentations.length === 0) throw new Error("No hay productos que coincidan con el filtro.");
      
      setMessage(`Actualizando ${presentations.length} presentaciones...`);
      
      // 2. Modificar los precios
      const factor = 1 + (p / 100);
      
      // Como no hay endpoint bulk RPC, lo hacemos iterando (en un sistema real seria mejor un RPC)
      // Supabase limita a 1000 items por bulk update, pero aquí tenemos IDs y cada uno tiene precio distinto,
      // la forma más fácil es usando un Promise.all en chunks o creando una RPC.
      // Aquí haremos las actualizaciones individuales.
      
      const updates = presentations.map(pres => {
        const newPrice = Math.round((pres.sale_price * factor) * 100) / 100; // Redondear a 2 decimales
        return sb.from("product_presentations").update({ sale_price: newPrice }).eq("id", pres.id);
      });
      
      // Ejecutar en lotes de a 10 para no saturar la red
      for (let i = 0; i < updates.length; i += 10) {
        await Promise.all(updates.slice(i, i + 10));
      }
      
      setMessage(`Se actualizaron exitosamente ${presentations.length} presentaciones.`);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard>
      <h2>Actualización Masiva de Precios</h2>
      <p>Modificá los precios de venta en lote, aplicando un porcentaje de aumento o descuento.</p>
      
      {error && <Badge tone="error" style={{ marginBottom: "1rem" }}>{error}</Badge>}
      {message && <Badge tone="aviso" style={{ marginBottom: "1rem" }}>{message}</Badge>}

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <SelectField
          label="Aplicar a"
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value as "all" | "brand" | "category"); setFilterId(""); }}
        >
          <option value="all">Todo el catálogo</option>
          <option value="brand">Una Marca específica</option>
          <option value="category">Una Categoría específica</option>
        </SelectField>

        {filterType === "brand" && (
          <SelectField label="Marca" value={filterId} onChange={e => setFilterId(e.target.value)}>
            <option value="">Seleccione marca...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
        )}

        {filterType === "category" && (
          <SelectField label="Categoría" value={filterId} onChange={e => setFilterId(e.target.value)}>
            <option value="">Seleccione categoría...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        )}

        <TextField
          label="Porcentaje (%)"
          type="number"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          required
        />
        
        <Button 
          variant="primario" 
          onClick={handleUpdate} 
          disabled={loading || (filterType !== 'all' && !filterId) || !percentage}
        >
          Aplicar Actualización
        </Button>
      </div>
    </GlassCard>
  );
}
