const fs = require('fs');
let code = fs.readFileSync('src/shared/offline/sync.ts', 'utf8');

const oldCode = `let inFlight: Promise<SyncResult> | undefined;

/**
 * Envía la cola en orden. Si ya hay una sincronización en curso, devuelve esa misma promesa en
 * lugar de mandar las operaciones dos veces en paralelo.
 */
export function synchronizePendingOperations(): Promise<SyncResult> {
  inFlight ??= runSynchronization().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}`;

// Note: It might have encoding like Enva... Let's use substring instead.
const startIdx = code.indexOf('let inFlight: Promise<SyncResult> | undefined;');
const endIdx = code.indexOf('async function runSynchronization');

if (startIdx !== -1 && endIdx !== -1) {
  const newCode = `let inFlight: Promise<SyncResult> | undefined;
let retryTimeout: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000;

export function synchronizePendingOperations(): Promise<SyncResult> {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
  }
  
  inFlight ??= runSynchronization().then((result) => {
    inFlight = undefined;
    if (result.failed > 0 && navigator.onLine) {
      console.warn("Reintentando en " + retryDelay + "ms");
      retryTimeout = setTimeout(() => {
        void synchronizePendingOperations();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 120000);
    } else {
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
  code = code.substring(0, startIdx) + newCode + code.substring(endIdx);
  fs.writeFileSync('src/shared/offline/sync.ts', code);
  console.log("Patched sync.ts");
} else {
  console.log("Could not find patch points");
}
