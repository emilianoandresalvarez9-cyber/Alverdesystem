import { describe, expect, it } from "vitest";
import { ScanDetector } from "./scanDetector";

function feed(detector: ScanDetector, text: string, start: number, gap: number): string | null {
  let result: string | null = null;
  [...text, "Enter"].forEach((key, index) => {
    result = detector.push(key, start + index * gap);
  });
  return result;
}

describe("ScanDetector (RF-18, GRAVE-06)", () => {
  it("reconoce un lector: 13 dígitos a 10 ms y Enter", () => {
    expect(feed(new ScanDetector(), "7790001000017", 0, 10)).toBe("7790001000017");
  });

  it("ignora a una persona tipeando despacio", () => {
    expect(feed(new ScanDetector(), "7790001000017", 0, 150)).toBeNull();
  });

  it("ignora un Enter con pocos dígitos (por ejemplo, un peso)", () => {
    expect(feed(new ScanDetector(), "350", 0, 10)).toBeNull();
  });

  it("un escaneo después de tipear despacio no arrastra los dígitos anteriores", () => {
    const detector = new ScanDetector();
    detector.push("3", 0);
    detector.push("5", 500);
    expect(feed(detector, "2000000000015", 1000, 8)).toBe("2000000000015");
  });
});
