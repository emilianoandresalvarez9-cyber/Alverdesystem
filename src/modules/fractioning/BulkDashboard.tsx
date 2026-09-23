import { useState } from "react";
import { Button } from "../../shared/ui";
import { StockDashboard } from "../stock/StockDashboard";
import { ShelfLifeManager } from "./ShelfLifeManager";

type BulkTab = "operations" | "shelf_life";

export function BulkDashboard() {
  const [activeTab, setActiveTab] = useState<BulkTab>("operations");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
      {/* Sub-tabs locales de Fraccionamiento */}
      <div style={{ display: "flex", gap: "var(--esp-xs)", marginBottom: "var(--esp-s)" }}>
        <Button
          variant={activeTab === "operations" ? "secundario" : "fantasma"}
          onClick={() => setActiveTab("operations")}
        >
          ⚖️ Lotes y Fraccionamiento
        </Button>
        <Button
          variant={activeTab === "shelf_life" ? "secundario" : "fantasma"}
          onClick={() => setActiveTab("shelf_life")}
        >
          ⏱️ Vida Útil (Masivo)
        </Button>
      </div>

      {activeTab === "operations" && (
        <>
          <p style={{ margin: "0 0 var(--esp-m)", color: "var(--color-tinta-suave)", fontSize: "var(--texto-s)" }}>
            El módulo de lotes permite abrir bolsas a granel y fraccionar unidades. (RF-11 a RF-16)
          </p>
          {/* Reutilizamos el StockDashboard de Agente E, pero le indicaremos luego 
              que muestre botones de fraccionar */}
          <StockDashboard enableFractioning={true} />
        </>
      )}

      {activeTab === "shelf_life" && (
        <ShelfLifeManager />
      )}
    </div>
  );
}
