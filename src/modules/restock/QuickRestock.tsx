import { useEffect, useState, type FormEvent } from "react";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { useBranch } from "../../shared/branch/BranchContext";
import { getSupabase } from "../../shared/supabase/client";
import { loadCatalogSnapshot } from "../../shared/offline/queue";
import { queueStockOperation, watchStockOperationSync } from "../stock/offlineStock";
import { Button, Icon, Message, SelectField, TextField } from "../../shared/ui";
import type { PresentationLookupResult } from "./types";
import type { CatalogProduct } from "../catalog/types";
import { lookupEntriesFromCatalog, presentationsForCode } from "./presentationLookup";
import "../../styles/stock.css";

interface QuickRestockProps {
  onSuccess?: () => void;
}

const LOOKUP_COLUMNS =
  "presentation_id, presentation_name, product_id, product_name, base_quantity, sale_price, internal_barcode, manufacturer_barcode, base_unit, sold_by_weight, open_shelf_life_days";

export function QuickRestock({ onSuccess }: QuickRestockProps) {
  const profile = useCurrentProfile();
  // RF-65/66: el ingreso entra en la sucursal de trabajo; con "Todas" hay que elegir una.
  const branch = useBranch();
  const needsBranch = branch.writeId === null;
  const [barcode, setBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  // Presentaciones que trae el código; con más de una hay que elegir cuál entra.
  const [matches, setMatches] = useState<PresentationLookupResult[]>([]);
  const [chosenId, setChosenId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFeedbackId) return;
    return watchStockOperationSync(pendingFeedbackId, () => {
      setSuccessMsg("Ingreso sincronizado correctamente.");
      setPendingFeedbackId(null);
    });
  }, [pendingFeedbackId]);

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const code = barcode.trim();
    if (!code) return;

    setSearching(true);
    setError(null);
    setSuccessMsg(null);
    setMatches([]);
    setChosenId("");

    const show = (found: PresentationLookupResult[]) => {
      setMatches(found);
      setChosenId(found.length === 1 ? found[0]!.presentation_id : "");
      setQuantity("1");
    };

    try {
      const supabase = getSupabase();

      // Buscar sobre la proyección operativa. La tabla base de productos y
      // presentaciones queda restringida para Empleado por RLS.
      const { data: internalMatches, error: internalErr } = await supabase
        .from("employee_catalog")
        .select(LOOKUP_COLUMNS)
        .eq("internal_barcode", code)
        .limit(1);

      if (internalErr) throw internalErr;

      let found = presentationsForCode((internalMatches ?? []) as PresentationLookupResult[], code);
      if (found.length === 0) {
        // El código de fabricante pertenece al producto: vienen todas sus presentaciones.
        const { data: manufacturerMatches, error: manufacturerErr } = await supabase
          .from("employee_catalog")
          .select(LOOKUP_COLUMNS)
          .eq("manufacturer_barcode", code);

        if (manufacturerErr) throw manufacturerErr;
        found = presentationsForCode((manufacturerMatches ?? []) as PresentationLookupResult[], code);
      }

      if (found.length > 0) show(found);
      else setError(`No se encontró ningún producto activo con el código: ${code}`);
    } catch (err) {
      const snapshot = await loadCatalogSnapshot();
      const cached = snapshot ? presentationsForCode(lookupEntriesFromCatalog(snapshot.rows as CatalogProduct[]), code) : [];
      if (cached.length > 0) {
        show(cached);
      } else {
        setError(err instanceof Error ? `${err.message} No hay un catálogo local que incluya ese código.` : "Error al buscar producto");
      }
    } finally {
      setSearching(false);
    }
  };

  const foundPresentation = matches.find((match) => match.presentation_id === chosenId) ?? null;
  const clearFound = () => {
    setMatches([]);
    setChosenId("");
  };

  const handleRestock = async () => {
    if (!foundPresentation) return;
    if (needsBranch) {
      setError("Elegí en qué sucursal entra la mercadería (arriba a la izquierda, en Sucursal).");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser un número mayor a 0");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await queueStockOperation({
        action: "quick_restock",
        presentationId: foundPresentation.presentation_id,
        targetPresentationId: foundPresentation.presentation_id,
        productId: foundPresentation.product_id,
        quantity: qty,
        expiryDate: expiryDate || null,
        productName: foundPresentation.product_name,
        presentationName: foundPresentation.presentation_name,
        baseUnit: foundPresentation.base_unit ?? "unit",
        baseQuantity: foundPresentation.base_quantity,
        soldByWeight: foundPresentation.sold_by_weight ?? false,
        openShelfLifeDays: foundPresentation.open_shelf_life_days ?? null,
        ...(typeof branch.writeId === "string" ? { branchId: branch.writeId } : {}),
        branchName: branch.label,
      }, profile.id);

      setSuccessMsg(`Ingreso guardado en este dispositivo. Se sincronizará al reconectar.`);
      setPendingFeedbackId(result.localId);
      clearFound();
      setBarcode("");
      setQuantity("");
      setExpiryDate("");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el lote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="carta pila" aria-labelledby="ingreso-titulo">
      <div className="fila fila--entre">
        <h2 className="titulo-seccion" id="ingreso-titulo">Ingreso rápido</h2>
        {!needsBranch && <p className="meta">La mercadería entra en <strong className="fuerte">{branch.label}</strong>.</p>}
      </div>
      {needsBranch && (
        <Message tone="aviso">Elegí en qué sucursal entra la mercadería: estás viendo todas las sucursales.</Message>
      )}
      <form onSubmit={handleSearch} className="ingreso__busqueda">
        <TextField
          className="crece"
          label="Escanear código de barras"
          icon="barcode_scanner"
          placeholder="Código de fabricante o interno"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          autoFocus
        />
        <Button variant="secundario" icon="search" type="submit" disabled={searching || !barcode.trim()}>
          {searching ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {error && <Message tone="error">{error}</Message>}
      {successMsg && <Message tone="exito">{successMsg}</Message>}

      {matches.length > 0 && (
        <div className="pila ingreso__encontrado">
          <p className="fila">
            <Icon name="check_circle" />
            <span>
              <strong className="fuerte">{matches[0]!.product_name}</strong>
              {foundPresentation && matches.length === 1 && <span className="suave"> · {foundPresentation.presentation_name}</span>}
            </span>
          </p>
          {matches.length > 1 && (
            <SelectField label="Presentación" value={chosenId} onChange={(e) => setChosenId(e.target.value)}
              help={`Este código es del producto y tiene ${matches.length} presentaciones: elegí cuál entra.`}>
              <option value="">Elegí la presentación…</option>
              {matches.map((match) => <option key={match.presentation_id} value={match.presentation_id}>{match.presentation_name}</option>)}
            </SelectField>
          )}
          <form className="form-fila" onSubmit={(e) => { e.preventDefault(); void handleRestock(); }}>
            <TextField
              label="Cantidad a ingresar"
              type="number"
              numeric
              min="0.001"
              step={0.001}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <TextField
              label="Vencimiento fabricante (opcional)"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <div className="fila ingreso__acciones">
              <Button variant="fantasma" onClick={clearFound}>Cancelar</Button>
              <Button type="submit" icon="add" loading={loading} disabled={!quantity || needsBranch || !foundPresentation}>
                {loading ? "Guardando…" : "Ingresar lote"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
