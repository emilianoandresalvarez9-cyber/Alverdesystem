import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { THEMES, THEME_COLORS, THEME_STORAGE_KEY } from "../../src/shared/theme/theme";

describe("Theme inline script (prevents FOUC)", () => {
  const rootDir = process.cwd();
  const htmlFiles = readdirSync(rootDir).filter((f) => f.endsWith(".html"));

  it("all html files have the inline script", () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
    
    for (const file of htmlFiles) {
      const content = readFileSync(join(rootDir, file), "utf8");
      expect(content, `File ${file} missing inline script`).toContain("localStorage.getItem(\"alverde-tema\")");
      
      // Verifica que las claves coincidan
      expect(content).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
      
      // Verifica que los temas coincidan
      for (const theme of THEMES) {
        expect(content).toContain(`"${theme}"`);
      }
      
      // Verifica que los colores coincidan
      for (const color of Object.values(THEME_COLORS)) {
        expect(content).toContain(`"${color}"`);
      }
    }
  });
});
