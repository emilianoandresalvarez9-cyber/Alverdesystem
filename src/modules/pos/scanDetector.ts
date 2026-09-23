/**
 * Distingue un lector de códigos "tipo teclado" (RF-18) de una persona tipeando: el lector
 * escribe muchos dígitos muy rápido y termina con Enter. Sirve también cuando el foco está en
 * otro campo (GRAVE-06): quien lo usa descarta el Enter y retira del campo lo que tipeó el lector.
 */
export class ScanDetector {
  private buffer = "";
  private lastAt = -Infinity;

  constructor(
    private readonly maxGapMs = 40,
    private readonly minLength = 8
  ) {}

  /** Devuelve el código si la tecla completó un escaneo; si no, null. */
  push(key: string, at: number): string | null {
    const gap = at - this.lastAt;
    this.lastAt = at;

    if (key === "Enter") {
      const code = this.buffer;
      this.buffer = "";
      return code.length >= this.minLength ? code : null;
    }

    if (/^\d$/.test(key)) {
      this.buffer = gap <= this.maxGapMs ? this.buffer + key : key;
      return null;
    }

    this.buffer = "";
    return null;
  }

  /** Cantidad de caracteres acumulados como posible escaneo (para retirarlos de un campo). */
  get pending(): number {
    return this.buffer.length;
  }
}
