import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { BarcodeSvg } from "./BarcodeSvg";
import { Button, Badge, EmptyState } from "../../shared/ui";
import type { BulkPresentationItem } from "./types";

export function CounterBulkSheet() {
  const [items, setItems] = useState<BulkPresentationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGraneleros() {
      const sb = getSupabase();
      // Obtener productos a granel (gramos) con sus presentaciones
      const { data, error } = await sb
        .from("products")
        .select(`
          id, name, base_unit, manufacturer_barcode,
          category:categories(name),
          presentations:product_presentations(id, name, internal_barcode, base_quantity, sale_price, active)
        `)
        .eq("active", true)
        .eq("base_unit", "gram"); // RF-22: Granel

      if (error || !data) {
        setLoading(false);
        return;
      }

      const flatItems: BulkPresentationItem[] = [];
      
      data.forEach((p: any) => {
        if (!p.presentations) return;
        p.presentations
          .filter((pr: any) => pr.active && pr.internal_barcode) // Solo los que ya tienen barcode generado
          .forEach((pr: any) => {
            flatItems.push({
              productId: p.id,
              productName: p.name,
              presentationId: pr.id,
              presentationName: pr.name,
              internalBarcode: pr.internal_barcode,
              manufacturerBarcode: p.manufacturer_barcode,
              categoryName: p.category?.name || "Sin Rubro",
              baseUnit: p.base_unit,
              baseQuantity: pr.base_quantity,
              salePrice: pr.sale_price,
            });
        });
      });

      // Ordenar por categoría y luego por nombre
      flatItems.sort((a, b) => {
        const catCompare = a.categoryName.localeCompare(b.categoryName);
        if (catCompare !== 0) return catCompare;
        return a.productName.localeCompare(b.productName);
      });

      setItems(flatItems);
      setLoading(false);
    }
    
    loadGraneleros();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div>Cargando planilla...</div>;

  if (items.length === 0) {
    return (
      <EmptyState title="No hay códigos generados">
        Primero debes generar los códigos internos EAN-13 para los productos a granel en la pestaña de gestión.
      </EmptyState>
    );
  }

  // Agrupar por categoría para renderizado
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.categoryName]) acc[item.categoryName] = [];
    acc[item.categoryName]!.push(item);
    return acc;
  }, {} as Record<string, BulkPresentationItem[]>);

  return (
    <div className="bulk-sheet-container">
      <div className="bulk-sheet-actions no-print" style={{ marginBottom: "var(--esp-m)" }}>
        <Button variant="primario" onClick={handlePrint}>🖨️ Imprimir Planilla</Button>
        <p style={{ color: "var(--color-tinta-suave)", fontSize: "0.9rem", marginTop: "var(--esp-xs)" }}>
          Esta planilla está optimizada para papel A4. Al imprimir se ocultarán los menúes.
        </p>
      </div>

      <div className="bulk-sheet-print-area" style={{ background: "white", color: "black", padding: "20px", borderRadius: "8px" }}>
        <h1 style={{ textAlign: "center", borderBottom: "2px solid black", paddingBottom: "10px", margin: "0 0 20px 0" }}>
          Códigos de Mostrador — Granel (RF-22)
        </h1>
        
        <p style={{ textAlign: "center", fontStyle: "italic", marginBottom: "20px" }}>
          * Escanear el código al momento de pesar. El sistema solicitará ingresar el peso leído de la balanza.
        </p>

        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} style={{ marginBottom: "30px", pageBreakInside: "avoid" }}>
            <h2 style={{ background: "#f0f0f0", padding: "5px 10px", margin: "0 0 15px 0", borderLeft: "4px solid black" }}>
              {category}
            </h2>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
              gap: "20px" 
            }}>
              {catItems.map(item => (
                <div key={item.presentationId} style={{ border: "1px dashed #ccc", padding: "10px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <strong style={{ fontSize: "1.1rem", marginBottom: "4px" }}>{item.productName}</strong>
                  <span style={{ fontSize: "0.85rem", color: "#555", marginBottom: "10px" }}>{item.presentationName}</span>
                  
                  {item.internalBarcode ? (
                    <BarcodeSvg 
                      code={item.internalBarcode} 
                      width={180} 
                      height={60} 
                      barColor="#000" 
                      bgColor="transparent" 
                    />
                  ) : (
                    <Badge tone="error">Sin código</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
