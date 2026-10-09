#!/usr/bin/env python3
"""Genera src/shared/supabase/database.types.ts desde el catálogo de Postgres, sin Docker.

Mismo formato que `supabase gen types typescript --local` (el que consume supabase-js).
Con Docker conviene la CLI oficial; esto es para agentes y equipos sin Docker.

Uso:  bash qa/pg-harness/run.sh .            # levanta la base con todas las migraciones
      python3 -I qa/pg-harness/gen_types.py > src/shared/supabase/database.types.ts
"""
import json
import os
import subprocess

PSQL = ["psql", "-h", os.environ.get("PGHOST", "/tmp"), "-p", os.environ.get("PGQA_PORT", "55432"),
        "-U", "postgres", "-d", os.environ.get("PGDATABASE", "alverde"), "-At", "-c"]


def q(sql):
    out = subprocess.run(PSQL + [f"select coalesce(json_agg(t), '[]') from ({sql}) t"],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


enums = {}
for r in q("""select t.typname as name, e.enumlabel as label from pg_type t
              join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'public' order by t.typname, e.enumsortorder"""):
    enums.setdefault(r["name"], []).append(r["label"])

NUM = {"int2", "int4", "int8", "float4", "float8", "numeric"}
STR = {"text", "varchar", "bpchar", "uuid", "date", "timestamptz", "timestamp", "time", "timetz",
       "interval", "bytea", "inet", "citext", "name"}


def ts(udt):
    is_array = udt.startswith("_")
    base = udt[1:] if is_array else udt
    if base in NUM: t = "number"
    elif base in STR: t = "string"
    elif base == "bool": t = "boolean"
    elif base in ("json", "jsonb"): t = "Json"
    elif base in enums: t = f'Database["public"]["Enums"]["{base}"]'
    elif base == "void": t = "undefined"
    elif base == "record": t = "Record<string, unknown>"
    else: t = "unknown"
    return f"{t}[]" if is_array and t != "unknown" else t


cols = q("""select c.relname as rel, c.relkind as kind, a.attname as col, t.typname as udt,
                   not a.attnotnull as nullable,
                   (a.atthasdef or a.attidentity <> '' or a.attgenerated <> '') as has_default
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
            join pg_type t on t.oid = a.atttypid
            where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
            order by c.relname, a.attnum""")
rels = {}
for r in cols:
    rels.setdefault((r["rel"], r["kind"]), []).append(r)

fks = q("""select con.conname as name, cl.relname as rel, rf.relname as ref,
                  (select json_agg(a.attname order by k.i) from unnest(con.conkey) with ordinality k(n, i)
                     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n) as cols,
                  (select json_agg(a.attname order by k.i) from unnest(con.confkey) with ordinality k(n, i)
                     join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n) as refcols,
                  exists (select 1 from pg_index ix where ix.indrelid = con.conrelid and ix.indisunique
                          and ix.indpred is null
                          and (select array_agg(x order by x) from unnest(ix.indkey::int2[]) x)
                            = (select array_agg(x order by x) from unnest(con.conkey) x)) as one
           from pg_constraint con join pg_class cl on cl.oid = con.conrelid
           join pg_class rf on rf.oid = con.confrelid join pg_namespace n on n.oid = cl.relnamespace
           where con.contype = 'f' and n.nspname = 'public' order by cl.relname, con.conname""")
fk_by_rel = {}
for f in fks:
    fk_by_rel.setdefault(f["rel"], []).append(f)

funcs = q("""select p.proname as name, p.proretset as setof, rt.typname as ret,
                    coalesce(p.proargnames, '{}') as argnames, coalesce(p.proargmodes::text[], '{}') as modes,
                    (select json_agg(t.typname order by k.i)
                       from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality k(o, i)
                       join pg_type t on t.oid = k.o) as types,
                    p.pronargdefaults as ndef, p.pronargs as nargs
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
             where n.nspname = 'public' and rt.typname not in ('trigger', 'event_trigger') and p.prokind = 'f'
               and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                               and d.objid = p.oid and d.deptype = 'e')
             order by p.proname, p.oid""")


def obj(fields, indent):
    if not fields:
        return "Record<PropertyKey, never>"
    pad = " " * indent
    return "{\n" + "".join(f"{pad}  {k}: {v}\n" for k, v in fields) + pad + "}"


def relblock(name, kind):
    c = rels[(name, kind)]
    def typ(r):
        return ts(r["udt"]) + (" | null" if r["nullable"] else "")
    lines = [f"      {name}: {{", f"        Row: {obj([(r['col'], typ(r)) for r in c], 8)}"]
    if kind in ("r", "p"):
        ins = [(r["col"] + ("?" if r["nullable"] or r["has_default"] else ""), typ(r)) for r in c]
        lines += [f"        Insert: {obj(ins, 8)}", f"        Update: {obj([(r['col'] + '?', typ(r)) for r in c], 8)}"]
    rl = [f'          {{ foreignKeyName: "{f["name"]}"; columns: {json.dumps(f["cols"])}; isOneToOne: '
          f'{str(f["one"]).lower()}; referencedRelation: "{f["ref"]}"; referencedColumns: {json.dumps(f["refcols"])} }}'
          for f in fk_by_rel.get(name, [])]
    lines.append("        Relationships: [" + ("\n" + ",\n".join(rl) + "\n        ]" if rl else "]"))
    lines.append("      }")
    return lines


out = ["// Generado por qa/pg-harness/gen_types.py desde supabase/migrations. No editar a mano.",
       "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]", "",
       "export type Database = {", "  public: {", "    Tables: {"]
for key in sorted(k for k in rels if k[1] in ("r", "p")):
    out += relblock(*key)
out += ["    }", "    Views: {"]
for key in sorted(k for k in rels if k[1] in ("v", "m")):
    out += relblock(*key)
out += ["    }", "    Functions: {"]
seen = set()
for f in funcs:
    if f["name"] in seen:
        continue  # sobrecargas: se tipa la primera, igual que el generador oficial con una sola firma
    seen.add(f["name"])
    names, types = f["argnames"], f["types"] or []
    modes = f["modes"] or ["i"] * len(types)
    ins = [(names[i] if i < len(names) and names[i] else f"arg{i}", types[i]) for i in range(len(types)) if modes[i] in ("i", "b", "v")]
    outs = [(names[i], types[i]) for i in range(len(types)) if modes[i] in ("t", "o", "b")]
    first_default = f["nargs"] - f["ndef"]
    args = [(n + ("?" if i >= first_default else ""), ts(t)) for i, (n, t) in enumerate(ins)]
    ret = (obj([(n, ts(t)) for n, t in outs], 8) if outs else ts(f["ret"])) + ("[]" if f["setof"] else "")
    out += [f"      {f['name']}: {{", f"        Args: {obj(args, 8)}", f"        Returns: {ret}", "      }"]
out += ["    }", "    Enums: {"]
out += [f"      {k}: " + " | ".join(json.dumps(v) for v in vals) for k, vals in sorted(enums.items())]
out += ["    }", "    CompositeTypes: {", "      [_ in never]: never", "    }", "  }", "}", "",
        'export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]',
        'export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]',
        'export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]', ""]
print("\n".join(out))
