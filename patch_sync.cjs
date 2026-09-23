const fs = require('fs');
let code = fs.readFileSync('src/shared/offline/sync.ts', 'utf8');

const newCode = `
let inFlight: Promise<SyncResult> | undefined;
let retryTimeout: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000; // Inicia en 2 segundos

/**
 * Envía la cola en orden. Si ya hay una sincronización en curso, devuelve esa misma promesa en
 * lugar de mandar las operaciones dos veces en paralelo. Implementa reintentos espaciados (backoff).
 */
export function synchronizePendingOperations(): Promise<SyncResult> {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
  }
  
  inFlight ??= runSynchronization().then((result) => {
    inFlight = undefined;
    
    // Si hubo fallos, planificar próximo reintento espaciado
    if (result.failed > 0 && navigator.onLine) {
      console.warn(\`Reintentando sincronización en \${retryDelay}ms...\`);
      retryTimeout = setTimeout(() => {
        void synchronizePendingOperations();
      }, retryDelay);
      
      // Exponential backoff hasta 2 minutos
      retryDelay = Math.min(retryDelay * 2, 120000);
    } else {
      // Resetear backoff si todo salió bien
      retryDelay = 2000;
    }
    
    return result;
  }).catch((err) => {
    inFlight = undefined;
    throw err;
  });
  return inFlight;
}
`;

code = code.replace(/let inFlight: Promise<SyncResult> \| undefined;[\s\S]*?return inFlight;\n}/, newCode.trim());

fs.writeFileSync('src/shared/offline/sync.ts', code);
