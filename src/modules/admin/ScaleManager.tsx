import { useState, useEffect } from "react";
import { GlassCard, Button, TextField, Badge } from "../../shared/ui";

export function ScaleManager() {
  const [comPort, setComPort] = useState("COM1");
  const [baudRate, setBaudRate] = useState("9600");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Simula lectura de config
    const saved = localStorage.getItem("alverde_scale_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      setComPort(parsed.comPort);
      setBaudRate(parsed.baudRate);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("alverde_scale_config", JSON.stringify({ comPort, baudRate }));
    // Simulamos conexión exitosa para la demo
    setConnected(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Administración de Balanza</h2>
        <p className="text-slate-400 text-sm">Configure la conexión con la balanza Systel o genérica (interfaz futura).</p>
      </div>

      <GlassCard className="p-6 max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Conexión Serie (RS232/USB)</h3>
          {connected ? (
            <Badge tone="exito">Conectada</Badge>
          ) : (
            <Badge tone="aviso">Desconectada</Badge>
          )}
        </div>

        <TextField
          label="Puerto COM"
          value={comPort}
          onChange={e => setComPort(e.target.value)}
          placeholder="Ej: COM1 o /dev/ttyUSB0"
        />

        <TextField
          label="Baud Rate"
          type="number"
          value={baudRate}
          onChange={e => setBaudRate(e.target.value)}
          placeholder="9600"
        />

        <Button onClick={handleSave} className="w-full">
          Guardar y Probar Conexión
        </Button>
      </GlassCard>

      <GlassCard className="p-6 max-w-md">
        <h3 className="font-semibold mb-2">Lectura de prueba</h3>
        <div className="bg-slate-900 p-4 rounded text-center text-3xl font-mono text-green-400">
          {connected ? "0.000 kg" : "---"}
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Funcionalidad futura. Esta interfaz es una maquetacion para futura integracion con hardware. La implementación de la API Web Serial o un agente local es necesaria para lectura real.
        </p>
      </GlassCard>
    </div>
  );
}
