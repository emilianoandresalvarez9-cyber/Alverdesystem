/**
 * Interfaces para futura integración con Balanzas vía Bluetooth o RS232 (RF-30).
 */

export interface ScaleWeightEvent {
  weight: number;
  unit: string;
  isStable: boolean;
  timestamp: Date;
}

export interface ScaleConnectionConfig {
  type: 'bluetooth' | 'rs232' | 'usb';
  baudRate?: number; // Para RS232
  deviceId?: string; // Para Bluetooth/USB
}

/**
 * Interfaz base que deberá implementar cualquier adaptador de balanza futuro.
 */
export interface IScaleAdapter {
  /**
   * Conecta a la balanza utilizando la configuración provista.
   */
  connect(config: ScaleConnectionConfig): Promise<void>;

  /**
   * Desconecta la balanza.
   */
  disconnect(): Promise<void>;

  /**
   * Obtiene el peso actual de manera sincrónica (polling).
   */
  getCurrentWeight(): Promise<ScaleWeightEvent>;

  /**
   * Suscribe a eventos de cambio de peso emitidos por la balanza.
   */
  onWeightChanged(callback: (event: ScaleWeightEvent) => void): void;

  /**
   * Suscribe a eventos de error.
   */
  onError(callback: (error: Error) => void): void;
}
