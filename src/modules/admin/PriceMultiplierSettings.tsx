import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, GlassCard, TextField } from "../../shared/ui";

type Category = { id: string; name: string; parent_id: string | null };
type OverrideRow = { category_id: string; multiplier: number };

export function PriceMultiplierSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultMultiplier, setDefaultMultiplier] = useState("2");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: settings, error: settingsError }, { data: categoryRows, error: categoryError },
      { data: multiplierRows, error: multiplierError }] = await Promise.all([
      sb.from("pricing_settings").select("default_multiplier").eq("id", 1).single(),
      sb.from("categories").select("id, name, parent_id").is("archived_at", null).order("name"),
      sb.from("category_price_multipliers").select("category_id, multiplier")
    ]);
    const queryError = settingsError ?? categoryError ?? multiplierError;
    if (queryError) { setError(queryError.message); return; }
    if (!settings) { setError("No se encontró la configuración general de precios."); return; }
    setDefaultMultiplier(String(settings.default_multiplier));
    setCategories((categoryRows ?? []) as Category[]);
    setOverrides(Object.fromEntries(((multiplierRows ?? []) as OverrideRow[]).map(row => [row.category_id, String(row.multiplier)])));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveDefault() {
    const value = Number(defaultMultiplier);
    if (!Number.isFinite(value) || value <= 0) return setError("El multiplicador general debe ser mayor que cero.");
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await getSupabase().from("pricing_settings")
      .update({ default_multiplier: value, updated_at: new Date().toISOString() }).eq("id", 1);
    if (saveError) setError(saveError.message);
    else setMessage("Multiplicador general guardado.");
    setSaving(false);
  }

  async function saveCategory(categoryId: string) {
    const value = overrides[categoryId]?.trim() ?? "";
    setSaving(true); setError(""); setMessage("");
    const query = value
      ? getSupabase().from("category_price_multipliers").upsert({ category_id: categoryId, multiplier: Number(value), updated_at: new Date().toISOString() })
      : getSupabase().from("category_price_multipliers").delete().eq("category_id", categoryId);
    if (value && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
      setError("El multiplicador del rubro debe ser mayor que cero.");
      setSaving(false);
      return;
    }
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message);
    else setMessage(value ? "Multiplicador del rubro guardado." : "El rubro ahora hereda su multiplicador.");
    setSaving(false);
  }

  return (
    <GlassCard>
      <h2>Multiplicadores de precio</h2>
      <p>Se aplica el multiplicador del producto; si no tiene, el del rubro más específico configurado; si tampoco, el general.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <TextField label="Multiplicador general" type="number" min="0.001" step="0.001" value={defaultMultiplier}
          onChange={event => setDefaultMultiplier(event.target.value)} help="El valor inicial del proyecto es ×2." />
        <Button onClick={() => void saveDefault()} disabled={saving}>Guardar valor general</Button>
      </div>
      <h3>Overrides por rubro</h3>
      {categories.length === 0 ? <p>No hay rubros activos para configurar.</p> : (
        <div style={{ display: "grid", gap: "var(--esp-xs)" }}>
          {categories.map(category => (
            <div key={category.id} style={{ display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap" }}>
              <span style={{ minWidth: "12rem", paddingBottom: "0.6rem" }}>
                {category.parent_id ? `↳ ${categories.find(row => row.id === category.parent_id)?.name ?? "Rubro"} / ` : ""}{category.name}
              </span>
              <TextField label={`Multiplicador para ${category.name}`} type="number" min="0.001" step="0.001"
                value={overrides[category.id] ?? ""} placeholder="Heredar" onChange={event => setOverrides(current => ({ ...current, [category.id]: event.target.value }))}
                help="Vacío: hereda del rubro padre o del valor general." />
              <Button variant="secundario" onClick={() => void saveCategory(category.id)} disabled={saving}>Guardar</Button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
