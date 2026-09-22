import { useEffect, useState } from "react";
import { pendingOperationCount, subscribeToQueueChanges } from "../offline/queue";

export function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    const updatePending = () => void pendingOperationCount().then(setPending);
    updatePending();

    addEventListener("online", updateNetwork);
    addEventListener("offline", updateNetwork);
    return subscribeToQueueChanges(() => {
      updatePending();
    });
  }, []);

  return (
    <p className={online ? "sync-status online" : "sync-status offline"} role="status">
      <span aria-hidden="true">●</span>
      {online ? "Conectado" : "Sin conexión"} · {pending} operación{pending === 1 ? "" : "es"} pendiente{pending === 1 ? "" : "s"}
    </p>
  );
}
