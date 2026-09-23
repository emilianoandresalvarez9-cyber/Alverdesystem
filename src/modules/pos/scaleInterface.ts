// RF-33b: Interfaz genérica sin implementar para conectar una balanza a futuro
export interface IScaleConnector {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  /**
   * Lee el peso actual en la balanza en gramos.
   */
  readWeightGrams(): Promise<number>;
  getStatus(): 'connected' | 'disconnected' | 'error';
}

/**
 * Factory preparado para el futuro. Alverde podrá comprar cualquier balanza
 * con puerto serie/USB (ej. Kretz) y un agente futuro solo implementará esta interfaz
 * utilizando la Web Serial API o WebUSB API sin tocar la UI.
 */
export class DummyScaleConnector implements IScaleConnector {
  async connect() { return false; }
  async disconnect() {}
  async readWeightGrams(): Promise<number> { throw new Error("Balanza no conectada físicamente (RF-33b)"); }
  getStatus(): 'error' { return 'error'; }
}
