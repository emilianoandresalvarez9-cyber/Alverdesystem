import { useState, useEffect } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { GlassCard, Button, TextField, Badge } from "../../shared/ui";

export function BranchesManager() {
  const [branches, setBranches] = useState<any[]>([]);
  const [registers, setRegisters] = useState<any[]>([]);

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    const supabase = getSupabase();
    const { data: bData } = await supabase.from('branches').select('*').order('name');
    const { data: rData } = await supabase.from('registers').select('*').order('name');
    setBranches(bData || []);
    setRegisters(rData || []);
  }

  return (
    <GlassCard>
      <h2>Gestión de Sucursales y Cajas (Agente L)</h2>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <h3>Sucursales</h3>
          {branches.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{b.name}</span>
              <Badge tone={b.active ? "exito" : "error"}>{b.active ? "Activa" : "Inactiva"}</Badge>
            </div>
          ))}
          <Button variant="secundario" style={{ marginTop: '1rem' }}>+ Nueva Sucursal</Button>
        </div>
        <div style={{ flex: 1 }}>
          <h3>Cajas Registradoras</h3>
          {registers.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{r.name} (Sucursal: {branches.find(b => b.id === r.branch_id)?.name})</span>
              <Badge tone="exito">Operativa</Badge>
            </div>
          ))}
          <Button variant="secundario" style={{ marginTop: '1rem' }}>+ Nueva Caja</Button>
        </div>
      </div>
    </GlassCard>
  );
}
