import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Theme Token Parity", () => {
  it("botanical and midnight define exactly the same CSS variables", () => {
    const rootDir = process.cwd();
    const bot = readFileSync(join(rootDir, "src/styles/themes/alverde-botanical.css"), "utf8");
    const mid = readFileSync(join(rootDir, "src/styles/themes/midnight-bio.css"), "utf8");

    const getVars = (css: string) => {
      const vars = new Set<string>();
      const matches = css.matchAll(/^\s*(--(?!ds-)[a-zA-Z0-9-]+)\s*:/gm);
      for (const m of matches) {
        vars.add(m[1]);
      }
      return vars;
    };

    const botVars = getVars(bot);
    const midVars = getVars(mid);

    const botOnly = [...botVars].filter(x => !midVars.has(x));
    const midOnly = [...midVars].filter(x => !botVars.has(x));

    expect(botOnly, `Variables only in botanical: ${botOnly.join(", ")}`).toEqual([]);
    expect(midOnly, `Variables only in midnight: ${midOnly.join(", ")}`).toEqual([]);
  });
});
