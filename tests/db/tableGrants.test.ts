import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cada tabla de `public` tiene que darle permiso explícito a `authenticated` en alguna
 * migración. No alcanza con los privilegios por defecto: el proyecto de producción no los
 * aplica, y el respaldo completo falló con "permission denied for table stock_warnings".
 * Las reglas por fila (RLS) siguen decidiendo qué filas ve cada uno.
 */
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

function strip(sql: string) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function analyze() {
  const created: string[] = [];
  const granted = new Set<string>();
  for (const file of files) {
    const sql = strip(readFileSync(join(dir, file), "utf8"));
    // Recorre creaciones y grants en el orden en que aparecen en el archivo.
    const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)|grant\s+[a-z,\s]+?\s+on\s+(all\s+tables\s+in\s+schema\s+public|(?:table\s+)?[^;]+?)\s+to\s+([^;]+);/gi;
    for (const m of sql.matchAll(pattern)) {
      if (m[1]) {
        if (!created.includes(m[1])) created.push(m[1]);
        continue;
      }
      const target = m[2] ?? "";
      const recipients = (m[3] ?? "").toLowerCase();
      if (!/\bauthenticated\b/.test(recipients)) continue;
      if (/all\s+tables\s+in\s+schema\s+public/i.test(target)) {
        created.forEach((t) => granted.add(t));
      } else {
        for (const t of target.matchAll(/public\.([a-z_]+)/gi)) granted.add(t[1]!);
      }
    }
  }
  return { created, granted };
}

describe("permisos explícitos de tablas", () => {
  it("toda tabla creada en public tiene un GRANT explícito a authenticated", () => {
    const { created, granted } = analyze();
    expect(created.length).toBeGreaterThan(20);
    const missing = created.filter((t) => !granted.has(t));
    expect(missing, `tablas sin GRANT a authenticated: ${missing.join(", ")}`).toEqual([]);
  });
});
