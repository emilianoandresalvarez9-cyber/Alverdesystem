import { useState } from "react";
import { SubTabs } from "../../shared/ui";
import { StockDashboard } from "../stock/StockDashboard";
import { ShelfLifeManager } from "./ShelfLifeManager";

type BulkTab = "operations" | "shelf_life";

/** Fraccionamiento y granel: la tabla de lotes filtrada a granel (RF-11 a RF-16) y la vida útil masiva (RF-17). */
export function BulkDashboard() {
  const [activeTab, setActiveTab] = useState<BulkTab>("operations");

  return (
    <>
      <SubTabs label="Fraccionamiento y granel" value={activeTab} onChange={setActiveTab}
        tabs={[{ value: "operations", label: "Lotes y fraccionamiento" }, { value: "shelf_life", label: "Vida útil" }]} />
      {activeTab === "operations" ? <StockDashboard enableFractioning onlyBulk /> : <ShelfLifeManager />}
    </>
  );
}
