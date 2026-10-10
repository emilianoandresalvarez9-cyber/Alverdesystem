import { useState } from "react";
import { AppShell } from "../shared/components/AppShell";
import { QuickRestock } from "../modules/restock/QuickRestock";
import { StockDashboard } from "../modules/stock/StockDashboard";
import { TransfersHistory } from "../modules/stock/TransfersHistory";

export function StockPage() {
  const [stockRevision, setStockRevision] = useState(0);

  return (
    <AppShell active="stock" title="Stock y reposición">
      <QuickRestock onSuccess={() => setStockRevision((revision) => revision + 1)} />
      <StockDashboard key={stockRevision} enableFractioning />
      <TransfersHistory refreshKey={stockRevision} />
    </AppShell>
  );
}

