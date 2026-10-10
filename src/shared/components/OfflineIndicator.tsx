import { useEffect, useState } from "react";
import { pendingOperationCount, subscribeToQueueChanges } from "../offline/queue";
import { Icon, type IconName } from "../ui/Icon";

export type ConnectionStatus = {
  tone: "ok" | "pendiente" | "sin";
  icon: IconName;
  /** Escritorio: «Conectado · 2 operaciones pendientes». */
  long: string;
  /** Celular: «2 pendientes», «Sin conexión · 3». */
  short: string;
};

const pendingText = (n: number) => (n === 1 ? "1 operación pendiente" : `${n} operaciones pendientes`);

/**
 * RF-36: qué dice la cabecera sobre la conexión y la cola offline.
 * Sin conexión siempre muestra cuántas operaciones esperan, aunque sean cero:
 * quien atiende sabe que no hay nada en riesgo.
 */
export function connectionStatus(online: boolean, pending: number): ConnectionStatus {
  if (!online) {
    return { tone: "sin", icon: "cloud_off", long: `Sin conexión · ${pendingText(pending)}`, short: `Sin conexión · ${pending}` };
  }
  if (pending > 0) {
    return { tone: "pendiente", icon: "sync", long: `Conectado · ${pendingText(pending)}`, short: `${pending} pendiente${pending === 1 ? "" : "s"}` };
  }
  return { tone: "ok", icon: "cloud_done", long: "Conectado", short: "Conectado" };
}

export function OfflineIndicator() {
  // RF-36: visible en todo momento, en todas las páginas (lo monta AppShell).
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    const updatePending = () => void pendingOperationCount().then(setPending);
    updatePending();

    addEventListener("online", updateNetwork);
    addEventListener("offline", updateNetwork);
    const unsubscribe = subscribeToQueueChanges(updatePending);
    return () => {
      removeEventListener("online", updateNetwork);
      removeEventListener("offline", updateNetwork);
      unsubscribe();
    };
  }, []);

  const status = connectionStatus(online, pending);
  return (
    <p className={`conexion conexion--${status.tone}`} role="status">
      <Icon name={status.icon} />
      <span className="conexion__largo">{status.long}</span>
      {/* Una sola de las dos se ve (y se lee) según el ancho. */}
      <span className="conexion__corto">{status.short}</span>
    </p>
  );
}
