const fs = require('fs');

let content = fs.readFileSync('src/modules/admin/ProductsManager.tsx', 'utf8');
content = content.replace('const [errorMsg, setErrorMsg] = useState("");', 'const [errorMsg, setErrorMsg] = useState("");\n  const [pricePrompt, setPricePrompt] = useState<{presId: string, oldPrice: number} | null>(null);\n  const [newPriceInput, setNewPriceInput] = useState("");');

const oldHandle = `const handleUpdatePrice = async (presId: string, oldPrice: number) => {
    const newPrice = prompt("Nuevo precio (esto guardará historial RF-27):", oldPrice.toString());
    if (!newPrice) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPrice) }).eq("id", presId);
    if (error) setErrorMsg(error.message);
    else {
      await loadData();
      if (selectedProduct) {
        const { data } = await sb.from("product_presentations").select("*").eq("product_id", selectedProduct.id);
        setPresentations(data || []);
      }
    }
  };`;

const oldHandleCorrupted = `const handleUpdatePrice = async (presId: string, oldPrice: number) => {
    const newPrice = prompt("Nuevo precio (esto guardar\u00EDa historial RF-27):", oldPrice.toString());
    if (!newPrice) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPrice) }).eq("id", presId);
    if (error) setErrorMsg(error.message);
    else {
      await loadData();
      if (selectedProduct) {
        const { data } = await sb.from("product_presentations").select("*").eq("product_id", selectedProduct.id);
        setPresentations(data || []);
      }
    }
  };`;
  
const oldHandle3 = `const handleUpdatePrice = async (presId: string, oldPrice: number) => {
    const newPrice = prompt("Nuevo precio (esto guardarǭ historial RF-27):", oldPrice.toString());
    if (!newPrice) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPrice) }).eq("id", presId);
    if (error) setErrorMsg(error.message);
    else {
      await loadData();
      if (selectedProduct) {
        const { data } = await sb.from("product_presentations").select("*").eq("product_id", selectedProduct.id);
        setPresentations(data || []);
      }
    }
  };`;

const newHandle = `const handleUpdatePrice = (presId: string, oldPrice: number) => {
    setPricePrompt({presId, oldPrice});
    setNewPriceInput(oldPrice.toString());
  };

  const confirmUpdatePrice = async () => {
    if (!pricePrompt) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPriceInput) }).eq("id", pricePrompt.presId);
    if (error) setErrorMsg(error.message);
    else {
      await loadData();
      if (selectedProduct) {
        const { data } = await sb.from("product_presentations").select("*").eq("product_id", selectedProduct.id);
        setPresentations(data || []);
      }
    }
    setPricePrompt(null);
  };`;

content = content.replace(oldHandle, newHandle);
content = content.replace(oldHandleCorrupted, newHandle);
content = content.replace(oldHandle3, newHandle);

const modal = `</div>

      {pricePrompt && (
        <div className="modal-overlay">
          <GlassCard className="modal-content">
            <h3>Actualizar Precio (RF-27)</h3>
            <TextField label="Nuevo Precio" type="number" value={newPriceInput} onChange={e => setNewPriceInput(e.target.value)} autoFocus />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--esp-xs)", marginTop: "var(--esp-m)" }}>
              <Button variant="fantasma" onClick={() => setPricePrompt(null)}>Cancelar</Button>
              <Button onClick={confirmUpdatePrice}>Guardar</Button>
            </div>
          </GlassCard>
        </div>
      )}

    </GlassCard>`;
content = content.replace('</div>\n    </GlassCard>', modal);
fs.writeFileSync('src/modules/admin/ProductsManager.tsx', content, 'utf8');
