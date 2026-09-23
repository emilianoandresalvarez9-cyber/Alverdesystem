import { useState } from "react";
import { Button } from "../../shared/ui";
import { enqueueOperation } from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";

type State = "idle" | "saving" | "done" | "error";

/** RF-49: cualquier empleado avisa que un producto falta o se está acabando. Funciona sin conexión. */
export function MissingReportButton({ productId, productName }: { productId: string; productName: string }) {
  const [state, setState] = useState<State>("idle");

  async function report() {
    setState("saving");
    try {
      await enqueueOperation({ kind: "missing_item", payload: { productId } });
      setState("done");
      void synchronizePendingOperations().catch(() => undefined);
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="pos-feedback" data-tone="ok" role="status">Listo: {productName} quedó en la lista de reposición.</p>;
  }
  return (
    <>
      <Button variant="secundario" onClick={() => void report()} loading={state === "saving"}>Avisar que falta</Button>
      {state === "error" && <p className="pos-feedback" data-tone="error" role="alert">No se pudo guardar el aviso en este equipo. Probá de nuevo.</p>}
    </>
  );
}
