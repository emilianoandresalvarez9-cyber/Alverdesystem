#!/usr/bin/env node
// Compuerta de calidad estática. Corre en CI y localmente con `npm run qa:guard`.
// Falla (exit 1) ante patrones que en este repo ya produjeron falsos verdes.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "coverage"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (p) => relative(root, p).split(sep).join("/");
const files = walk(root).map((p) => ({ path: rel(p), full: p }));
const isTest = (p) => /\.test\.(ts|tsx)$/.test(p);

// 1. Tests que no prueban nada.
const fakeAssertion = /expect\(\s*(true|false|1|0|null|undefined)\s*\)\s*\.\s*(toBe|toEqual|toStrictEqual)\(\s*(true|false|1|0|null|undefined)\s*\)/;
const focused = /\b(it|test|describe)\.only\s*\(/;
for (const f of files.filter((f) => isTest(f.path))) {
  const src = readFileSync(f.full, "utf8");
  if (fakeAssertion.test(src)) errors.push(`${f.path}: aserción vacía (expect(true).toBe(true) o similar). Usá it.todo si el test aún no existe.`);
  if (focused.test(src)) errors.push(`${f.path}: test enfocado (.only) — oculta el resto de la suite.`);
  const cases = (src.match(/\b(it|test)\s*\(/g) ?? []).length;
  if (cases > 0 && !/\bexpect\s*\(/.test(src)) errors.push(`${f.path}: tiene casos pero ningún expect().`);
}

// 2. Mocks en código de producción: lista de trinquete que solo puede achicarse.
const allowFile = "qa/mocks-conocidos.txt";
const allowed = existsSync(allowFile)
  ? readFileSync(allowFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : [];
const mockPattern = /\bmock/i;
const prodSources = files.filter((f) => f.path.startsWith("src/") && /\.(ts|tsx)$/.test(f.path) && !isTest(f.path));
for (const f of prodSources) {
  const hasMock = mockPattern.test(readFileSync(f.full, "utf8"));
  if (hasMock && !allowed.includes(f.path)) errors.push(`${f.path}: contiene datos/lógica mock en código de producción.`);
}
for (const path of allowed) {
  const f = prodSources.find((s) => s.path === path);
  if (!f || !mockPattern.test(readFileSync(f.full, "utf8"))) {
    errors.push(`${allowFile}: '${path}' ya no tiene mocks. Quitalo de la lista (la lista solo se achica).`);
  }
}

// 3. Tests SQL con plan y cierre explícitos (pg_prove necesita ambos para reportar bien).
for (const f of files.filter((f) => /^supabase\/tests\/.+\.sql$/.test(f.path))) {
  const sql = readFileSync(f.full, "utf8").toLowerCase();
  if (!/\bplan\s*\(/.test(sql) || !/\bfinish\s*\(/.test(sql)) errors.push(`${f.path}: falta plan(n) o finish().`);
}

if (errors.length) {
  console.error(`\nqa:guard encontró ${errors.length} problema(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("");
  process.exit(1);
}
console.log(`qa:guard OK — ${files.filter((f) => isTest(f.path)).length} archivos de test revisados, ${allowed.length} mock(s) conocidos pendientes.`);
