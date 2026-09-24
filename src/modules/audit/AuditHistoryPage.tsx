import type { SupabaseAny } from "../../shared/types";
import { useState, useEffect } from "react";
import { GlassCard, EmptyState } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";

interface AuditRecord {
  id: number;
  entity: string;
  entity_id: string;
  field: string;
  old_value: SupabaseAny;
  new_value: SupabaseAny;
  user_id: string;
  occurred_at: string;
  profiles?: {
    display_name: string;
  };
}

export function AuditHistoryPage() {
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError(null);
      
      const sb = getSupabase();
      
      // Verificamos si es admin usando la función RPC
      const { data: isAdmin, error: rpcError } = await sb.rpc('is_administrator');
      
      if (rpcError || !isAdmin) {
         setError("Acceso denegado: Se requiere rol de Administrador para ver la trazabilidad.");
         setLoading(false);
         return;
      }

      const { data, error: fetchError } = await sb
        .from("audit_history")
        .select(`
          id,
          entity,
          entity_id,
          field,
          old_value,
          new_value,
          user_id,
          occurred_at,
          profiles ( display_name )
        `)
        .order("occurred_at", { ascending: false })
        .limit(100);

      if (fetchError) {
        setError("Error al cargar el historial de auditoría.");
      } else {
        setHistory(data as SupabaseAny);
      }
      setLoading(false);
    }
    
    loadHistory();
  }, []);

  if (loading) {
    return <EmptyState title="Cargando historial de auditoría..." />;
  }

  if (error) {
    return (
      <GlassCard>
        <p style={{ color: "var(--peligro-base)" }}>{error}</p>
      </GlassCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-l)" }}>
      <h2>Trazabilidad y Auditoría</h2>
      <p style={{ color: "var(--texto-secundario)", marginTop: "-var(--esp-m)" }}>
        Historial de modificaciones de entidades críticas (RF-56 a RF-60).
      </p>

      {history.length === 0 ? (
        <EmptyState title="No hay registros de auditoría recientes" />
      ) : (
        <GlassCard>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-borde)" }}>
                  <th style={{ padding: "var(--esp-s)" }}>Fecha</th>
                  <th style={{ padding: "var(--esp-s)" }}>Usuario</th>
                  <th style={{ padding: "var(--esp-s)" }}>Entidad</th>
                  <th style={{ padding: "var(--esp-s)" }}>Campo</th>
                  <th style={{ padding: "var(--esp-s)" }}>Valor Anterior</th>
                  <th style={{ padding: "var(--esp-s)" }}>Valor Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id} style={{ borderBottom: "1px solid var(--glass-borde)" }}>
                    <td style={{ padding: "var(--esp-s)" }}>
                      {new Date(record.occurred_at).toLocaleString("es-AR")}
                    </td>
                    <td style={{ padding: "var(--esp-s)" }}>
                      {record.profiles?.display_name || record.user_id}
                    </td>
                    <td style={{ padding: "var(--esp-s)" }}>{record.entity}</td>
                    <td style={{ padding: "var(--esp-s)" }}>{record.field}</td>
                    <td style={{ padding: "var(--esp-s)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <pre style={{ margin: 0, fontSize: "0.85em", color: "var(--texto-secundario)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {JSON.stringify(record.old_value)}
                      </pre>
                    </td>
                    <td style={{ padding: "var(--esp-s)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <pre style={{ margin: 0, fontSize: "0.85em", color: "var(--primario-hover)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {JSON.stringify(record.new_value)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
