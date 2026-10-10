import { useState } from "react";
import { Button } from "../../shared/ui";
import { enqueueOperation } from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";
import { useBranch } from "../../shared/branch/BranchContext";

type State = "idle" | "saving" | "done" | "error";

/** RF-49: cualquier empleado avisa que un producto falta o se está acabando. Funciona sin conexión. */
export function MissingReportButton({ productId, productName }: { productId: string; productName: string }) {
  const [state, setState] = useState<State>("idle");
  // RF-70: el faltante es de la sucursal de trabajo (empleado: la suya; administradora: la elegida).
  const branch = useBranch();
  const needsBranch = branch.writeId === null;

  async function report() {
    setState("saving");
    try {
      await enqueueOperation({
        kind: "missing_item",
        payload: { productId, ...(typeof branch.writeId === "string" ? { branchId: branch.writeId } : {}) }
      });
      setState("done");
      void synchronizePendingOperations().catch(() => undefined);
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="pos-feedback" data-tone="ok" role="status">Listo: {productName} quedó en la lista de reposición de {branch.label}.</p>;
  }
  return (
    <>
      <Button variant="secundario" onClick={() => void report()} loading={state === "saving"} disabled={needsBranch}
        title={needsBranch ? "Elegí una sucursal para avisar el faltante" : undefined}>Avisar que falta</Button>
      {needsBranch && <p className="field-help">Elegí una sucursal en la barra lateral para avisar que falta.</p>}
      {state === "error" && <p className="pos-feedback" data-tone="error" role="alert">No se pudo guardar el aviso en este equipo. Probá de nuevo.</p>}
    </>
  );
}
