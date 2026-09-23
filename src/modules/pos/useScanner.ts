import { useEffect, useRef } from "react";
import { ScanDetector } from "./scanDetector";

const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

/**
 * Escucha el lector de códigos en toda la página (RF-18). Si el foco está en otro campo (por
 * ejemplo, el peso), el Enter del lector no se propaga y los dígitos que escribió se retiran de
 * ese campo (GRAVE-06). El campo de escaneo propio se ignora: lo procesa su formulario.
 */
export function useScanner(onScan: (code: string) => void, ignoreTarget: () => HTMLElement | null): void {
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    const detector = new ScanDetector();

    const onKeyDown = (event: KeyboardEvent) => {
      const typedChars = detector.pending;
      const code = detector.push(event.key, event.timeStamp || performance.now());
      if (!code) return;

      const target = event.target;
      if (target instanceof HTMLElement && target === ignoreTarget()) return;

      event.preventDefault();
      event.stopPropagation();

      if (target instanceof HTMLInputElement && nativeValueSetter) {
        const cleaned = target.value.slice(0, Math.max(0, target.value.length - typedChars));
        nativeValueSetter.call(target, cleaned);
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      handler.current(code);
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [ignoreTarget]);
}
