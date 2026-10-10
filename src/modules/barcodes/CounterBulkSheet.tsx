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
          presentations:product_presentations(id, name, internal_barcode, base_quantity, sale_price, active, sold_by_weight)
        `)
        .eq("active", true)
        .eq("base_unit", "gram"); // RF-22: Granel

      if (error || !data) {
        setLoading(false);
        return;
      }

      const flatItems: BulkPresentationItem[] = [];
      
      data.forEach((p) => {
        if (!p.presentations) return;
        p.presentations
          .filter((pr) => pr.active && pr.sold_by_weight && pr.internal_barcode) // Solo "Balanza" con código (las bolsitas se escanean de su paquete)
          .forEach((pr) => {
            flatItems.push({
              productId: p.id,
              productName: p.name,
              presentationId: pr.id,
              presentationName: pr.name,
              internalBarcode: pr.internal_barcode,
              manufacturerBarcode: p.manufacturer_barcode,
              categoryName: p.category?.name || "Sin rubro",
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

  if (loading) return <div className="pila pila--s" aria-busy="true" aria-label="Cargando planilla…"><span className="esqueleto" /><span className="esqueleto" /></div>;

  if (items.length === 0) {
    return (
      <EmptyState title="Todavía no hay códigos para imprimir" icon="barcode">
        Aparecen acá las presentaciones marcadas «Balanza» que ya tienen código. Marcalas en Balanza y generá
        sus códigos en la pestaña Códigos internos.
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
    <div className="pila">
      <div className="fila fila--entre no-print">
        <p className="cuerpo-s suave">Hoja A4 en blanco y negro. Al imprimir no salen los menús.</p>
        <Button icon="print" onClick={handlePrint}>Imprimir planilla</Button>
      </div>

      <div className="bulk-sheet-print-area planilla">
        <h1 className="planilla__titulo">Códigos de mostrador · granel</h1>
        <p className="planilla__nota">Escanear el código al pesar: la caja pide el peso que marca la balanza.</p>

        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="planilla__rubro">
            <h2 className="planilla__rubro-titulo">{category}</h2>
            <div className="planilla__reja">
              {catItems.map(item => (
                <div key={item.presentationId} className="planilla__codigo">
                  <strong>{item.productName}</strong>
                  <span>{item.presentationName} · pesar y escanear</span>
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
