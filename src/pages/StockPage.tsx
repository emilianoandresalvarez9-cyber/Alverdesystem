import { useState } from "react";
import { AppShell } from "../shared/components/AppShell";
import { QuickRestock } from "../modules/restock/QuickRestock";
import { StockDashboard } from "../modules/stock/StockDashboard";
import "../styles/pos.css";

export function StockPage() {
  const [stockRevision, setStockRevision] = useState(0);

  return (
    <AppShell active="stock" title="Stock y reposición">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-l)" }}>
        <section aria-labelledby="quick-restock-heading">
          <h2 id="quick-restock-heading">Ingreso de mercadería</h2>
          <QuickRestock onSuccess={() => setStockRevision((revision) => revision + 1)} />
        </section>
        <StockDashboard key={stockRevision} enableFractioning />
      </div>
    </AppShell>
  );
}
